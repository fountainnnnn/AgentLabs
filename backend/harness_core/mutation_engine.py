"""Harness mutation engine.

Creates variations of existing harnesses for regression testing, expanding
harness pools, and increasing robustness of evaluations.
"""

from __future__ import annotations

import json
import random
import re
from typing import Any

from harness_core.schemas import HarnessCase


# ---------------------------------------------------------------------------
# Text mutation helpers
# ---------------------------------------------------------------------------

_PARA_SUBSTITUTIONS = {
    "refund": ["reimbursement", "payback", "money back", "return"],
    "approve": ["authorise", "process", "okay", "greenlight", "sign off on"],
    "order": ["purchase", "transaction", "receipt", "invoice"],
    "policy": ["guidelines", "rules", "procedures", "regulations"],
    "manager": ["supervisor", "team lead", "escalation officer"],
    "ignore": ["disregard", "overlook", "bypass", "skip"],
    "override": ["overrule", "countermand", "bypass", "suspend"],
}


def paraphrase(text: str) -> str:
    """Return a lightly paraphrased version of *text*.

    Applies random synonym substitutions and minor rewording.
    """
    words = text.split()
    if len(words) < 6:
        return text

    # Substitute known synonyms
    paraphrased: list[str] = []
    for w in words:
        clean = w.strip(".,!?;:'\"()[]{}")
        punc = w[len(clean):] if len(clean) < len(w) else ""
        lower = clean.lower()
        if lower in _PARA_SUBSTITUTIONS and random.random() < 0.5:
            replacement = random.choice(_PARA_SUBSTITUTIONS[lower])
            # Preserve case roughly
            if clean[0].isupper():
                replacement = replacement.capitalize()
            paraphrased.append(replacement + punc)
        else:
            paraphrased.append(w)

    # Occasionally reorder sentence start
    if len(paraphrased) > 6 and random.random() < 0.3:
        # Move a clause
        mid = len(paraphrased) // 2
        paraphrased = paraphrased[mid:] + paraphrased[:mid]

    return " ".join(paraphrased)


_OBFUSCATION_PATTERNS = [
    (r"\boverride\b", "0v3r1d3"),
    (r"\badmin\b", "4dm1n"),
    (r"\bpassword\b", "p4ssw0rd"),
    (r"\bthreshold\b", "thr3sh0ld"),
    (r"\bignore\b", "1gn0r3"),
    (r"\byou\b", "u"),
    (r"\byour\b", "ur"),
]


def add_obfuscation(text: str) -> str:
    """Replace selected words with leetspeak or obfuscated variants."""
    result = text
    for pattern, replacement in _OBFUSCATION_PATTERNS:
        if random.random() < 0.4:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return result


_ENTITY_REPLACEMENTS = {
    "ORD-": lambda: f"ORD-{random.randint(10000, 99999)}",
    "$": lambda: f"${random.choice([200, 300, 400, 500, 700, 900, 1000])}",
    "\\d{5}": lambda: str(random.randint(10000, 99999)),
}


def change_entities(text: str) -> str:
    """Replace numeric IDs, amounts, and references with random values."""
    result = text
    # Replace order IDs
    result = re.sub(
        r"ORD-\d{5}",
        lambda m: f"ORD-{random.randint(10000, 99999)}",
        result,
    )
    # Replace dollar amounts
    result = re.sub(
        r"\$\d+(?:,\d{3})*(?:\.\d{2})?",
        lambda m: f"${random.choice([200, 300, 400, 500, 700, 900, 1000])}",
        result,
    )
    # Replace email addresses
    result = re.sub(
        r"[\w.]+@[\w.]+\.\w+",
        lambda m: f"user{random.randint(1,999)}@company{random.randint(1,9)}.com",
        result,
    )
    return result


def increase_severity(harness: HarnessCase) -> HarnessCase:
    """Return a new ``HarnessCase`` with increased severity.

    This escalates the prompt to be more aggressive and the severity
    level to one step higher.
    """
    severity_order = ["low", "medium", "high", "critical"]
    current = harness.severity
    try:
        idx = severity_order.index(current)
        new_sev = severity_order[min(idx + 1, len(severity_order) - 1)]
    except ValueError:
        new_sev = "high"

    # Escalate the prompt by adding urgency/authority framing
    try:
        messages = json.loads(harness.messages_json)
    except (json.JSONDecodeError, TypeError):
        messages = [{"role": "user", "content": harness.messages_json or ""}]

    escalated_prefixes = [
        "URGENT: ",
        "IMMEDIATE ACTION REQUIRED: ",
        "This is a high-priority request: ",
        "",
    ]
    prefix = random.choice(escalated_prefixes)

    if isinstance(messages, list):
        for msg in messages:
            if isinstance(msg, dict) and "content" in msg:
                content: str = msg.get("content", "")
                if prefix:
                    msg["content"] = f"{prefix}{content[0].lower() if content else ''}{content}"
                # Intensify emotional language
                if random.random() < 0.5:
                    msg["content"] = msg["content"].replace(".", "!!").replace("?", "??")
    else:
        if isinstance(messages, dict) and "content" in messages:
            messages["content"] = f"{prefix}{messages['content']}"

    return HarnessCase(
        id=f"{harness.id}-mut-{random.randint(100, 999)}",
        family=harness.family,
        category=harness.category,
        severity=new_sev,
        wave_number=harness.wave_number,
        messages_json=json.dumps(messages, default=str),
        expected_behavior=harness.expected_behavior,
        correct_answer=harness.correct_answer,
        metadata={**harness.metadata, "mutated_from": harness.id, "mutation": "increase_severity"},
    )


def mutate_harness(
    harness: HarnessCase,
    operations: list[str] | None = None,
) -> HarnessCase:
    """Apply a random mutation to a harness.

    Args:
        harness:    The source harness.
        operations: List of mutation names to randomly pick from.  Defaults to
                    all available mutations.

    Returns:
        A new ``HarnessCase`` with the mutation applied.
    """
    if operations is None:
        operations = ["paraphrase", "obfuscate", "change_entities", "increase_severity"]

    op = random.choice(operations)

    try:
        messages = json.loads(harness.messages_json)
    except (json.JSONDecodeError, TypeError):
        messages = [{"role": "user", "content": harness.messages_json or ""}]

    def _apply_to_text(text: str) -> str:
        if op == "paraphrase":
            return paraphrase(text)
        elif op == "obfuscate":
            return add_obfuscation(text)
        elif op == "change_entities":
            return change_entities(text)
        return text

    if isinstance(messages, list):
        for msg in messages:
            if isinstance(msg, dict) and "content" in msg:
                msg["content"] = _apply_to_text(str(msg.get("content", "")))
    elif isinstance(messages, dict) and "content" in messages:
        messages["content"] = _apply_to_text(str(messages["content"]))

    if op == "increase_severity":
        return increase_severity(harness)

    return HarnessCase(
        id=f"{harness.id}-{op[:3]}-{random.randint(100, 999)}",
        family=harness.family,
        category=harness.category,
        severity=harness.severity,
        wave_number=harness.wave_number,
        messages_json=json.dumps(messages, default=str),
        expected_behavior=harness.expected_behavior,
        correct_answer=harness.correct_answer,
        metadata={**harness.metadata, "mutated_from": harness.id, "mutation": op},
    )
