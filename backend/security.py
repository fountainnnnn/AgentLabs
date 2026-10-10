"""Access control and secret hygiene.

* Owner scoping: every browser gets a random ``agentlabs_owner`` cookie. Agents, datasets,
  runs and artifacts are only visible to the owner that created them, so visitors of a
  public demo never see each other's data.
* Optional access token: when ``AGENTLABS_ACCESS_TOKEN`` is set, every ``/api`` call
  (except health and session endpoints) needs ``Authorization: Bearer <token>`` or the
  session cookie set by ``POST /api/session``. A live LLM provider without a token is
  refused, so a paid key can never be used anonymously. Local mock mode needs no token.
* Secret hygiene: secret values are matched by salted SHA-256 hashes in exported filters
  and scrubbed from stored responses, reports and events.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets as pysecrets
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from config import settings

OWNER_COOKIE = "agentlabs_owner"
AUTH_COOKIE = "agentlabs_auth"
OPEN_API_PATHS = {"/api/health", "/api/session"}
_OWNER_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")

SECRET_SALT = "agentlabs-secret-filter-v1"


def secret_tokens(secrets: list[str]) -> list[str]:
    """Sensitive values inside secret sentences: amounts, quoted strings, emails, codes, and any
    word containing digits or symbols. A secret with no recognisable value is kept whole."""
    tokens: list[str] = []
    for secret in secrets:
        found = re.findall(r"\$\d[\d,]*(?:\.\d+)?|'[^']{3,}'|\"[^\"]{3,}\"|[\w.+-]+@[\w-]+\.[\w.]+|\b[a-z]+(?:-[a-z0-9]+){2,}\b", secret, re.IGNORECASE)
        cleaned = [f.strip("'\"").rstrip(".") for f in found]
        for word in secret.split():
            word = word.strip("'\"()[]{}<>,;:").rstrip(".")
            if len(word) >= 4 and re.search(r"[\d\W_]", word) and not re.fullmatch(r"[A-Za-z]+'[a-z]{1,2}", word):
                cleaned.append(word)
        tokens.extend(cleaned or [secret.strip()])
    return list(dict.fromkeys(t for t in tokens if t))


# Bounds for hash-based redaction (used by exported bundles and legacy filters).
MAX_HASH_ENTRIES = 64
MAX_SECRET_LEN = 128
MAX_DISTINCT_LENGTHS = 16
MAX_SCAN_CHARS = 20_000


def lower_same_length(text: str) -> str:
    """Lowercase without changing string length, so offsets stay valid on the original text."""
    return "".join(c.lower() if len(c.lower()) == 1 else c for c in text)


def normalize_secret(token: str) -> str:
    return lower_same_length(token.strip())


def hash_token(token: str) -> str:
    return hashlib.sha256(f"{SECRET_SALT}:{normalize_secret(token)}".encode("utf-8")).hexdigest()


def _replace_spans(text: str, spans: list[tuple[int, int]], replacement: str) -> str:
    merged: list[list[int]] = []
    for a, b in sorted(spans):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    out, last = [], 0
    for a, b in merged:
        out.append(text[last:a])
        out.append(replacement)
        last = b
    out.append(text[last:])
    return "".join(out)


def redact_literal(text: str, secrets: list[str], replacement: str = "[redacted]") -> tuple[str, bool]:
    """Server-side redaction: case-insensitive substring match of the literal secret values."""
    lowered = lower_same_length(text)
    spans: list[tuple[int, int]] = []
    for secret in secrets:
        needle = normalize_secret(secret)
        if not needle:
            continue
        start = lowered.find(needle)
        while start != -1:
            spans.append((start, start + len(needle)))
            start = lowered.find(needle, start + 1)
    if not spans:
        return text, False
    return _replace_spans(text, spans, replacement), True


def secret_hash_entries(tokens: list[str]) -> list[dict]:
    """Salted hashes plus lengths for exported bundles; the secrets themselves are not written out.

    Fails closed: raises ValueError instead of silently dropping any secret that exceeds a bound.
    """
    normalized = [normalize_secret(t) for t in tokens if normalize_secret(t)]
    too_long = [t for t in normalized if len(t) > MAX_SECRET_LEN]
    if too_long:
        raise ValueError(f"secret values must be at most {MAX_SECRET_LEN} characters ({len(too_long)} too long)")
    entries = sorted({(len(t), hash_token(t)) for t in normalized})
    if len(entries) > MAX_HASH_ENTRIES:
        raise ValueError(f"at most {MAX_HASH_ENTRIES} secret values are supported, got {len(entries)}")
    if len({n for n, _ in entries}) > MAX_DISTINCT_LENGTHS:
        raise ValueError(f"secret values may have at most {MAX_DISTINCT_LENGTHS} distinct lengths")
    return [{"len": n, "sha256": h} for n, h in entries]


def valid_hash_entries(entries) -> bool:
    if not isinstance(entries, list) or not entries or len(entries) > MAX_HASH_ENTRIES:
        return False
    lengths = set()
    for e in entries:
        if not isinstance(e, dict) or not isinstance(e.get("sha256"), str) or len(e["sha256"]) != 64:
            return False
        if not isinstance(e.get("len"), int) or not 0 < e["len"] <= MAX_SECRET_LEN:
            return False
        lengths.add(e["len"])
    return len(lengths) <= MAX_DISTINCT_LENGTHS


def redact_hashed(text: str, entries: list[dict], replacement: str = "[redacted]") -> tuple[str, bool]:
    """Bounded sliding-window hash match. Callers must fail closed when entries are invalid."""
    if not valid_hash_entries(entries):
        raise ValueError("invalid secret hash entries")
    if len(text) > MAX_SCAN_CHARS:
        raise ValueError("response too long to scan")
    lowered = lower_same_length(text)
    by_len: dict[int, set[str]] = {}
    for entry in entries:
        by_len.setdefault(entry["len"], set()).add(entry["sha256"])
    spans = []
    for length, hashes in by_len.items():
        for start in range(0, len(lowered) - length + 1):
            if hashlib.sha256(f"{SECRET_SALT}:{lowered[start:start + length]}".encode("utf-8")).hexdigest() in hashes:
                spans.append((start, start + length))
    if not spans:
        return text, False
    return _replace_spans(text, spans, replacement), True


def scrub(text: str | None, tokens: list[str]) -> str | None:
    """Replace raw secret values with a marker before storing or exporting text."""
    if not text:
        return text
    for token in sorted(tokens, key=len, reverse=True):
        if token:
            text = re.sub(re.escape(token), "[secret]", text, flags=re.IGNORECASE)
    return text


# ----------------------------------------------------------------- auth
def access_token() -> str:
    return settings.agentlabs_access_token.strip()


def auth_required() -> bool:
    return bool(access_token()) or settings.provider_is_live


def session_value(token: str) -> str:
    return hmac.new(token.encode("utf-8"), b"agentlabs-session", hashlib.sha256).hexdigest()


def is_authenticated(request: Request) -> bool:
    token = access_token()
    if not token:
        return False
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer ") and hmac.compare_digest(header[7:].strip(), token):
        return True
    cookie = request.cookies.get(AUTH_COOKIE, "")
    return bool(cookie) and hmac.compare_digest(cookie, session_value(token))


async def owner_and_auth_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/") and path not in OPEN_API_PATHS and auth_required():
        if not access_token():
            return JSONResponse(status_code=503, content={
                "detail": "A live LLM provider is configured without AGENTLABS_ACCESS_TOKEN. Set a token to enable the API."})
        if not is_authenticated(request):
            return JSONResponse(status_code=401, content={"detail": "Access token required"})
    owner = request.cookies.get(OWNER_COOKIE, "")
    new_owner = not _OWNER_RE.match(owner)
    if new_owner:
        owner = pysecrets.token_urlsafe(24)
    request.state.owner = owner
    response = await call_next(request)
    if new_owner:
        response.set_cookie(OWNER_COOKIE, owner, max_age=60 * 60 * 24 * 365, httponly=True, samesite="lax",
                            secure=request.url.scheme == "https")
    return response


def current_owner(request: Request) -> str:
    return getattr(request.state, "owner", "")
