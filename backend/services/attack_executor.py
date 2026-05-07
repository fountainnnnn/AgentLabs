"""Attack executor. Runs attacks against the target agent and collects results."""
from services.target_agent import TargetAgentRunner
from services.verifier import Verifier


class AttackExecutor:
    def __init__(self, runner: TargetAgentRunner):
        self.runner = runner
        self.verifier = Verifier(runner)

    async def execute_wave(self, attacks: list[dict], wave: int, phase: str = "pre_patch") -> list[dict]:
        """Execute a wave of attacks. Returns list of result dicts."""
        results = []
        for attack in attacks:
            result = await self.execute_single(attack, wave, phase)
            results.append(result)
        return results

    async def execute_single(self, attack: dict, wave: int, phase: str) -> dict:
        """Execute a single attack and verify the result."""
        prompt = attack.get("prompt", "")
        category = attack.get("category", "unknown")

        # Run target agent
        agent_result = await self.runner.run(prompt)
        response = agent_result.get("content", "")
        tool_calls = agent_result.get("tool_calls", [])

        # Verify deterministically
        verification = self.verifier.verify(
            user_message=prompt,
            agent_response=response,
            tool_calls=tool_calls,
            attack_category=category,
        )

        return {
            "attack_id": attack.get("id"),
            "wave": wave,
            "phase": phase,
            "prompt": prompt,
            "category": category,
            "agent_response": response,
            "tool_calls": tool_calls,
            "passed": 1 if verification["passed"] else 0,
            "failure_category": verification.get("failure_category"),
            "failure_reason": verification.get("failure_reason"),
        }
