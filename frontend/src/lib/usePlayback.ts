import { useCallback, useEffect, useRef, useState } from "react";
import { followRun, type RunEvent, type RunStatus } from "@/lib/api";
import { applyAll, applyEvent, initialPlayback, type PlaybackState } from "@/lib/arenaPlayback";

/**
 * Follows a backend run and replays its events into arena state at a readable pace.
 * Events are buffered as they arrive; speed scales the hold time of each event and
 * skip() applies everything that is buffered (and everything that arrives later) instantly.
 */
export function usePlayback(initialLabel: string) {
  const [state, setState] = useState<PlaybackState>(() => initialPlayback(initialLabel));
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const buffer = useRef<RunEvent[]>([]);
  const cursor = useRef(0);
  const fetchDone = useRef(true);
  const skipping = useRef(false);
  const timer = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const stateRef = useRef(state);
  stateRef.current = state;
  const waiters = useRef<((s: PlaybackState) => void)[]>([]);

  const tick = useCallback(() => {
    timer.current = null;
    if (cursor.current < buffer.current.length) {
      if (skipping.current) {
        const rest = buffer.current.slice(cursor.current);
        cursor.current = buffer.current.length;
        const next = applyAll(stateRef.current, rest);
        stateRef.current = next;
        setState(next);
        timer.current = window.setTimeout(tick, 50);
        return;
      }
      const { state: next, delay } = applyEvent(stateRef.current, buffer.current[cursor.current]);
      cursor.current += 1;
      stateRef.current = next;
      setState(next);
      timer.current = window.setTimeout(tick, Math.max(16, delay / speedRef.current));
      return;
    }
    if (fetchDone.current) {
      setPlaying(false);
      skipping.current = false;
      const done = stateRef.current;
      waiters.current.splice(0).forEach((resolve) => resolve(done));
      return;
    }
    timer.current = window.setTimeout(tick, 250);
  }, []);

  /** Follow a run. Resolves with the final playback state once every event has been shown. */
  const play = useCallback(
    (runId: string, options: { reset?: boolean; label?: string } = {}) =>
      new Promise<PlaybackState>((resolve) => {
        abort.current?.abort();
        if (timer.current) window.clearTimeout(timer.current);
        const controller = new AbortController();
        abort.current = controller;
        buffer.current = [];
        cursor.current = 0;
        fetchDone.current = false;
        skipping.current = false;
        waiters.current.push(resolve);
        const base = options.reset === false ? { ...stateRef.current, finished: false, failed: false } : initialPlayback(options.label ?? "Starting run");
        stateRef.current = base;
        setState(base);
        setPlaying(true);
        setRunStatus("queued");
        followRun(
          runId,
          (events, status) => {
            buffer.current.push(...events);
            setRunStatus(status);
          },
          controller.signal,
        )
          .catch((error: Error) => {
            buffer.current.push({ seq: -1, type: "error", wave: null, phase: null, message: error.message, payload: {}, created_at: null });
          })
          .finally(() => {
            fetchDone.current = true;
          });
        timer.current = window.setTimeout(tick, 50);
      }),
    [tick],
  );

  const skip = useCallback(() => {
    skipping.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(tick, 0);
  }, [tick]);

  const reset = useCallback((label: string) => {
    abort.current?.abort();
    if (timer.current) window.clearTimeout(timer.current);
    buffer.current = [];
    cursor.current = 0;
    fetchDone.current = true;
    const base = initialPlayback(label);
    stateRef.current = base;
    setState(base);
    setPlaying(false);
    setRunStatus(null);
  }, []);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { state, play, skip, reset, playing, runStatus, speed, setSpeed };
}
