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

from fastapi import Request
from fastapi.responses import JSONResponse

from config import settings

OWNER_COOKIE = "agentlabs_owner"
AUTH_COOKIE = "agentlabs_auth"
OPEN_API_PATHS = {"/api/health", "/api/session"}
_OWNER_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")

SECRET_SALT = "agentlabs-secret-filter-v1"


def normalize_secret(token: str) -> str:
    return token.strip().lower()


def hash_token(token: str) -> str:
    return hashlib.sha256(f"{SECRET_SALT}:{normalize_secret(token)}".encode("utf-8")).hexdigest()


def secret_hash_entries(tokens: list[str]) -> list[dict]:
    """Salted hashes plus lengths, so secrets can be found as substrings without storing them."""
    entries = {(len(normalize_secret(t)), hash_token(t)) for t in tokens if normalize_secret(t)}
    return [{"len": n, "sha256": h} for n, h in sorted(entries)]


def redact_hashed(text: str, entries: list[dict], replacement: str = "[redacted]") -> tuple[str, bool]:
    """Redact every substring whose salted hash matches an entry (sliding window per secret length)."""
    lowered = text.lower()
    by_len: dict[int, set[str]] = {}
    for entry in entries:
        by_len.setdefault(int(entry["len"]), set()).add(entry["sha256"])
    spans: list[tuple[int, int]] = []
    for length, hashes in by_len.items():
        for start in range(0, len(lowered) - length + 1):
            window = lowered[start : start + length]
            if hashlib.sha256(f"{SECRET_SALT}:{window}".encode("utf-8")).hexdigest() in hashes:
                spans.append((start, start + length))
    if not spans:
        return text, False
    spans.sort()
    merged: list[list[int]] = []
    for a, b in spans:
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
    return "".join(out), True


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
