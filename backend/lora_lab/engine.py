"""Real LoRA training and inference for local Hugging Face causal LMs.

Optional: requires ``torch``, ``transformers`` and ``peft`` (``pip install -r backend/requirements-ml.txt``).
All imports happen inside functions so the app runs without these packages.

Training is deliberately small (a manual AdamW loop over a few steps on CPU or GPU),
freezes the base model, and saves only the adapter.
"""

from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any, Callable

PROMPT_FORMAT = "### Instruction:\n{prompt}\n### Response:\n"
_lock = threading.Lock()
_base_cache: dict[str, tuple[Any, Any]] = {}


def _load_base(model_path: str):
    from transformers import AutoModelForCausalLM, AutoTokenizer

    with _lock:
        if model_path not in _base_cache:
            tokenizer = AutoTokenizer.from_pretrained(model_path)
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token
            model = AutoModelForCausalLM.from_pretrained(model_path)
            model.eval()
            _base_cache[model_path] = (model, tokenizer)
        return _base_cache[model_path]


def _device():
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


def guess_target_modules(model) -> list[str]:
    names = {name.split(".")[-1] for name, _ in model.named_modules()}
    for candidates in (["c_attn"], ["q_proj", "v_proj"], ["query_key_value"], ["qkv_proj"], ["query", "value"]):
        if all(c in names for c in candidates):
            return candidates
    raise ValueError("Could not find attention projection modules for LoRA on this architecture.")


def generate(model_path: str, prompts: list[str], adapter_dir: str | None = None, max_new_tokens: int = 40) -> list[str]:
    """Greedy (deterministic) generation with the base model, optionally with a LoRA adapter."""
    import torch

    base, tokenizer = _load_base(model_path)
    model = base
    if adapter_dir:
        from peft import PeftModel
        from transformers import AutoModelForCausalLM

        # fresh base copy: injecting the adapter must not mutate the cached base model
        model = PeftModel.from_pretrained(AutoModelForCausalLM.from_pretrained(model_path), adapter_dir)
    device = _device()
    model.to(device)
    model.eval()
    outputs = []
    with torch.no_grad():
        for prompt in prompts:
            text = PROMPT_FORMAT.format(prompt=prompt)
            enc = tokenizer(text, return_tensors="pt", truncation=True, max_length=256).to(device)
            out = model.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False,
                                 pad_token_id=tokenizer.pad_token_id, eos_token_id=tokenizer.eos_token_id)
            decoded = tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).strip()
            outputs.append(decoded or "(empty generation)")
    return outputs


def train_lora(model_path: str, samples: list[dict[str, Any]], output_dir: str, *, rank: int, alpha: int,
               dropout: float, learning_rate: float, steps: int, batch_size: int,
               on_step: Callable[[int, float], None] | None = None) -> dict[str, Any]:
    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM

    _, tokenizer = _load_base(model_path)
    # Train on a fresh copy so the cached base model used for baseline inference is untouched.
    model = AutoModelForCausalLM.from_pretrained(model_path)
    target_modules = guess_target_modules(model)
    config = LoraConfig(r=rank, lora_alpha=alpha, lora_dropout=dropout, target_modules=target_modules,
                        bias="none", task_type="CAUSAL_LM")
    model = get_peft_model(model, config)
    device = _device()
    model.to(device)
    model.train()

    texts = [PROMPT_FORMAT.format(prompt=s["prompt"]) + s["target"] + (tokenizer.eos_token or "") for s in samples]
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=learning_rate)
    trace = []
    started = time.perf_counter()
    torch.manual_seed(0)
    for step in range(1, steps + 1):
        start = ((step - 1) * batch_size) % len(texts)
        batch = [texts[(start + i) % len(texts)] for i in range(batch_size)]
        enc = tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=192).to(device)
        labels = enc["input_ids"].clone()
        labels[enc["attention_mask"] == 0] = -100
        loss = model(**enc, labels=labels).loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        value = float(loss.detach().cpu())
        trace.append({"step": step, "loss": round(value, 4), "learning_rate": learning_rate})
        if on_step:
            on_step(step, value)
    elapsed = time.perf_counter() - started
    model.save_pretrained(output_dir)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    files = sorted(str(p.name) for p in Path(output_dir).iterdir())
    return {
        "trace": trace,
        "trainable_params": trainable,
        "frozen_params": total - trainable,
        "total_params": total,
        "target_modules": target_modules,
        "device": device,
        "seconds": round(elapsed, 2),
        "samples_per_second": round(steps * batch_size / max(elapsed, 1e-6), 2),
        "adapter_files": files,
    }
