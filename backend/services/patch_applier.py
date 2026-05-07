"""Patch applier. Applies patches to the target agent config and tracks changes."""
from services.target_agent import TargetAgentRunner


class PatchApplier:
    def __init__(self, runner: TargetAgentRunner):
        self.runner = runner
        self.applied_patches: list[dict] = []

    def apply(self, patch: dict, wave: int) -> dict:
        """Apply a patch and return a summary of what changed."""
        before = self.runner.get_config_snapshot()
        self.runner.apply_patch(patch)
        after = self.runner.get_config_snapshot()

        changes = self._diff_configs(before, after)
        self.applied_patches.append({
            "wave": wave,
            "patch": patch,
            "changes": changes,
            "config_snapshot": after,
        })

        return {
            "wave": wave,
            "description": patch.get("description", "Unnamed patch"),
            "changes": changes,
        }

    def get_all_patches(self) -> list[dict]:
        return self.applied_patches

    def _diff_configs(self, before: dict, after: dict) -> dict:
        """Compute what changed between before and after configs."""
        changes = {}

        # System prompt changes
        before_rules = before.get("system_prompt", "").split("\n")
        after_rules = after.get("system_prompt", "").split("\n")
        added_rules = [r for r in after_rules if r.strip() and r not in before_rules]
        if added_rules:
            changes["added_system_rules"] = added_rules

        # Tool changes
        before_tools = {t["name"]: t for t in before.get("tools", [])}
        after_tools = {t["name"]: t for t in after.get("tools", [])}
        tool_changes = []
        for name, tool in after_tools.items():
            if name in before_tools:
                if tool != before_tools[name]:
                    tool_changes.append({"tool": name, "action": "modified", "details": tool})
            else:
                tool_changes.append({"tool": name, "action": "added"})
        if tool_changes:
            changes["tool_changes"] = tool_changes

        # Output filter changes
        before_filters = before.get("output_filters", [])
        after_filters = after.get("output_filters", [])
        new_filters = [f for f in after_filters if f not in before_filters]
        if new_filters:
            changes["added_output_filters"] = new_filters

        return changes
