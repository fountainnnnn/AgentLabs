"""Adapter freezer - freeze base model parameters and apply LoRA adapters."""

from __future__ import annotations

from typing import Any


def freeze_base_parameters(model: Any) -> dict[str, Any]:
    """Freeze all base model parameters.

    Sets ``requires_grad = False`` on every parameter and returns a
    report of what was frozen.

    Args:
        model: A PyTorch model (or any object with a ``named_parameters()``
               method that yields ``(name, param)`` tuples).

    Returns:
        Dict with keys:
            - frozen_params  (int)  -- total number of frozen elements
            - status         (str)  -- ``"base_frozen"`` on success
            - param_count    (int)  -- number of parameter tensors frozen
    """
    frozen_elements = 0
    param_count = 0

    try:
        for name, param in model.named_parameters():
            param.requires_grad = False
            frozen_elements += param.numel()
            param_count += 1
    except AttributeError:
        return {
            "frozen_params": 0,
            "status": "failed",
            "error": "model does not support named_parameters()",
        }

    return {
        "frozen_params": frozen_elements,
        "status": "base_frozen",
        "param_count": param_count,
    }


def apply_lora_adapter(
    model: Any,
    config: Any,
) -> tuple[Any, dict[str, Any]]:
    """Apply LoRA adapters on top of a frozen base model using PEFT.

    This is a best-effort operation.  If PEFT is not installed the original
    model is returned with a report indicating the adapter was not applied.

    Args:
        model: A HuggingFace ``PreTrainedModel`` (or compatible).
        config: An object with an ``adapter_rank`` attribute (e.g.
                ``RLModelConfig`` or ``TrainingConfig``).

    Returns:
        Tuple of (model, report).  ``report`` is a dict with keys:
            - trainable_params (int)
            - status           (str)  -- ``"lora_applied"`` or ``"lora_unavailable"``
            - error            (str, optional)
    """
    rank = getattr(config, "adapter_rank", 8)
    lora_alpha = rank * 2

    try:
        from peft import LoraConfig, get_peft_model

        lora_config = LoraConfig(
            r=rank,
            lora_alpha=lora_alpha,
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
        )
        model = get_peft_model(model, lora_config)
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        return model, {
            "trainable_params": trainable,
            "status": "lora_applied",
            "rank": rank,
            "lora_alpha": lora_alpha,
        }
    except ImportError:
        return model, {
            "status": "lora_unavailable",
            "trainable_params": 0,
            "error": "PEFT (peft) is not installed. Install: pip install peft",
        }
    except Exception as exc:
        return model, {
            "status": "lora_error",
            "trainable_params": 0,
            "error": str(exc),
        }


def get_trainable_summary(model: Any) -> dict[str, Any]:
    """Return a summary of trainable vs frozen parameters in a model.

    Works with both regular and PEFT models.

    Args:
        model: Any PyTorch model with ``named_parameters()``.

    Returns:
        Dict with trainable_params, frozen_params, total_params,
        trainable_pct, frozen_pct.
    """
    trainable = 0
    frozen = 0

    try:
        for _, param in model.named_parameters():
            n = param.numel()
            if param.requires_grad:
                trainable += n
            else:
                frozen += n
    except AttributeError:
        return {"error": "model does not support named_parameters()"}

    total = trainable + frozen
    return {
        "trainable_params": trainable,
        "frozen_params": frozen,
        "total_params": total,
        "trainable_pct": round(trainable / max(total, 1) * 100, 4),
        "frozen_pct": round(frozen / max(total, 1) * 100, 4),
    }
