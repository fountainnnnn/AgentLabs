
import { useRef, useState, useEffect, useCallback } from "react";
import PixiArena from "./PixiArena";
import ArenaSpeedControls from "./ArenaSpeedControls";
import BossWaveBanner from "./BossWaveBanner";
import type { BattleState, AttackScenario, BattleEvent } from "@/types/agentforge";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface PixiArenaWrapperProps {
  battleState: BattleState;
  onAnimationComplete?: (event: string) => void;
  onAttackResolved?: (attackId: string, result: "blocked" | "failed") => void;
  onWaveComplete?: () => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Mode mapping                                                      */
/* ------------------------------------------------------------------ */

function mapMode(mode: BattleState["mode"]): "agent_hardening" | "rl_lab" {
  switch (mode) {
    case "initial":
    case "patched":
    case "retest":
      return "agent_hardening";
    default:
      return "agent_hardening";
  }
}

function isBossWaveFromState(state: BattleState): boolean {
  const hasBossAttack = state.attacks.some(
    (a) => a.category === "multi_turn_escalation",
  );
  return hasBossAttack;
}

/* ------------------------------------------------------------------ */
/*  PixiArenaWrapper                                                  */
/* ------------------------------------------------------------------ */

export default function PixiArenaWrapper({
  battleState,
  onAnimationComplete,
  onAttackResolved,
  onWaveComplete,
  className = "",
}: PixiArenaWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  const prevAtkIdxRef = useRef(-1);
  const skipRef = useRef(false);

  /* ---- Track attack index changes to handle skip ---- */
  useEffect(() => {
    const curr = battleState.currentAttackIndex;
    if (curr !== prevAtkIdxRef.current) {
      prevAtkIdxRef.current = curr;
      skipRef.current = false;
    }
  }, [battleState.currentAttackIndex]);

  /* ---- Measure container with ResizeObserver ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(el);

    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* ---- Speed change handler ---- */
  const handleSpeedChange = useCallback(
    (speed: number) => {
      setAnimationSpeed(speed);
      if (speed >= 999) {
        skipRef.current = true;
        /* Fire attack resolved for all pending attacks */
        const currentAtk = battleState.attacks[battleState.currentAttackIndex];
        if (currentAtk) {
          const result =
            currentAtk.status === "blocked" ? "blocked" : "failed";
          onAttackResolved?.(currentAtk.id, result);
        }
        /* Reset speed after skip */
        setTimeout(() => {
          setAnimationSpeed(1.0);
          skipRef.current = false;
        }, 100);
      }
    },
    [battleState.attacks, battleState.currentAttackIndex, onAttackResolved],
  );

  /* ---- Boss wave detection ---- */
  const boss = isBossWaveFromState(battleState);
  const bossType =
    battleState.attacks.find((a) => a.category === "multi_turn_escalation")
      ?.label ?? undefined;

  /* ---- Build enemy states map ---- */
  const enemyStatesMap: Record<string, string> = {};
  battleState.attacks.forEach((atk) => {
    enemyStatesMap[atk.id] = atk.enemyState ?? "idle";
  });

  /* ---- Defender state from status ---- */
  const defenderStateMap: Record<string, string> = {
    idle: "idle",
    running_wave: "idle",
    attack_blocked: "defend",
    attack_failed: "damaged",
    patching: "patch",
    upgraded: "victory",
    completed: "idle",
    collapsed: "broken",
  };
  const defenderState =
    defenderStateMap[battleState.status] ?? "idle";

  /* ---- Narration text from latest event ---- */
  const narration =
    battleState.events.length > 0
      ? battleState.events[battleState.events.length - 1].message
      : "";

  /* ---- Render ---- */
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "400px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "inherit",
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <PixiArena
          width={dimensions.width}
          height={dimensions.height}
          mode={mapMode(battleState.mode)}
          wave={battleState.currentWave}
          combatants={battleState.attacks}
          events={battleState.events}
          defenderState={defenderState}
          enemyStates={enemyStatesMap}
          integrity={battleState.integrity}
          shield={battleState.shield}
          score={battleState.score}
          currentAttackIndex={battleState.currentAttackIndex}
          isWaveComplete={battleState.status === "completed"}
          narration={narration}
          animationSpeed={animationSpeed}
          onAttackResolved={onAttackResolved}
          onWaveComplete={onWaveComplete}
          bossWave={boss}
        />
      )}

      {/* Speed controls - bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: "52px",
          left: "12px",
          zIndex: 30,
        }}
      >
        <ArenaSpeedControls
          currentSpeed={animationSpeed}
          onSpeedChange={handleSpeedChange}
        />
      </div>

      {/* Boss wave banner */}
      <BossWaveBanner
        bossWave={boss}
        bossType={bossType}
        waveNumber={battleState.currentWave}
      />
    </div>
  );
}
