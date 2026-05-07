"""Tokenizer loading - real transformers with char-level fallback for simulation."""

from __future__ import annotations

from typing import Any


def load_tokenizer(
    source_type: str = "demo",
    path_or_name: str = "",
) -> tuple[Any, bool, str]:
    """Load a tokenizer from the given source.

    Args:
        source_type: One of "demo", "local_path", "uploaded", "huggingface".
        path_or_name: The local path, uploaded path, or HuggingFace model name.

    Returns:
        Tuple of (tokenizer_or_fallback, success, error_message).
        The fallback is a simple char-level tokenizer that always works.
    """
    if source_type == "demo":
        return _CharLevelTokenizer(), True, ""

    # Try real tokenizer loading
    try:
        from transformers import AutoTokenizer

        if source_type == "huggingface" and path_or_name:
            tokenizer = AutoTokenizer.from_pretrained(path_or_name)
            return tokenizer, True, ""

        if source_type in ("local_path", "uploaded") and path_or_name:
            tokenizer = AutoTokenizer.from_pretrained(path_or_name)
            return tokenizer, True, ""

    except ImportError:
        fallback = _CharLevelTokenizer()
        return fallback, False, "transformers not installed; using char-level fallback"
    except Exception as exc:
        fallback = _CharLevelTokenizer()
        return fallback, False, f"Failed to load tokenizer: {exc}"

    fallback = _CharLevelTokenizer()
    return fallback, False, f"Unknown source_type '{source_type}' or empty path"


class _CharLevelTokenizer:
    """Minimal char-level tokenizer that never requires external dependencies.

    Produces deterministic token-ids by hashing each character.  Useful for
    simulation / demo mode when transformers is not available.
    """

    def __init__(self) -> None:
        self.vocab_size = 256
        self.pad_token_id = 0
        self.eos_token_id = 1
        self.bos_token_id = 2
        self.padding_side = "right"
        self.truncation_side = "right"
        self.model_max_length = 2048

    def encode(self, text: str, **kwargs: Any) -> list[int]:
        """Encode text to a list of token ids (one per byte)."""
        return [min(b, self.vocab_size - 1) for b in text.encode("utf-8", errors="replace")]

    def decode(self, ids: list[int], **kwargs: Any) -> str:
        """Decode a list of token ids back to text."""
        valid = [b for b in ids if 0 <= b < 256]
        return bytes(valid).decode("utf-8", errors="replace")

    def __call__(self, text: str | list[str], **kwargs: Any) -> Any:
        """Mimic HuggingFace tokenizer __call__ returning a BatchEncoding-like dict."""
        if isinstance(text, str):
            text = [text]

        input_ids = []
        attention_mask = []
        max_len = kwargs.get("max_length", self.model_max_length)
        truncation = kwargs.get("truncation", False)
        padding = kwargs.get("padding", False)

        for t in text:
            ids = self.encode(t)
            if truncation and len(ids) > max_len:
                ids = ids[:max_len]
            input_ids.append(ids)
            attention_mask.append([1] * len(ids))

        if padding:
            pad_len = max(len(ids) for ids in input_ids)
            for i, ids in enumerate(input_ids):
                pad_count = pad_len - len(ids)
                input_ids[i] = ids + [self.pad_token_id] * pad_count
                attention_mask[i] = attention_mask[i] + [0] * pad_count

        return _BatchEncoding(input_ids=input_ids, attention_mask=attention_mask)

    def batch_decode(self, ids_list: list[list[int]], **kwargs: Any) -> list[str]:
        """Decode a batch of token id lists."""
        return [self.decode(ids, **kwargs) for ids in ids_list]


class _BatchEncoding:
    """Minimal stand-in for transformers.BatchEncoding."""

    def __init__(self, input_ids: list[list[int]], attention_mask: list[list[int]]) -> None:
        self.input_ids = input_ids
        self.attention_mask = attention_mask

    def to(self, device: str) -> _BatchEncoding:
        return self

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def keys(self) -> list[str]:
        return ["input_ids", "attention_mask"]
