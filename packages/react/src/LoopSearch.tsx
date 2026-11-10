"use client";
import type { LoopOptions, LoopSearch, Snapshot } from "@cytocausal/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface LoopSettings {
  title: string;
  description: string;
  /** Initial maximum number of nodes per cycle. Infinity removes the length bound. */
  maxLength: number;
  limit: number;
}

const defaults: LoopSettings = {
  title: "Cycles",
  description: "Directed routes that return to their starting node.",
  maxLength: 4,
  limit: 1000,
};
type SearchProgress = { status: LoopSearchStatus; cycles: string[]; elapsedMs: number; complete: boolean };

const LoopContext = createContext<{
  progress: Map<object, SearchProgress>;
  report: (key: object, progress: SearchProgress | null) => void;
  settings: LoopSettings;
  length: number;
  setLength: (n: number) => void;
  paused: boolean;
  setPaused: (paused: boolean) => void;
} | null>(null);

/** Each case owns its terminology, initial length and result budget. Remount to reset a case. */
export function LoopSettingsProvider({
  settings = defaults,
  children,
}: {
  settings?: LoopSettings;
  children: ReactNode;
}) {
  const [length, setLength] = useState(settings.maxLength);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(new Map<object, SearchProgress>());
  const report = useCallback((key: object, item: SearchProgress | null) => {
    setProgress((previous) => {
      const next = new Map(previous);
      if (item) next.set(key, item); else next.delete(key);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ settings, length, setLength, paused, setPaused, progress, report }),
    [settings, length, paused, progress, report],
  );
  return <LoopContext.Provider value={value}>{children}</LoopContext.Provider>;
}

export function LoopSearchControls() {
  const context = useContext(LoopContext);
  if (!context) return null;
  const { settings, length, setLength, paused, setPaused, progress } = context;
  const searches = [...progress.values()];
  const running = searches.some((search) => search.status === "searching");
  const finished = searches.filter((search) => search.status === "complete");
  const count = new Set(finished.flatMap((search) => search.cycles)).size;
  const elapsed = Math.max(0, ...finished.map((search) => search.elapsedMs));
  const incomplete = finished.some((search) => !search.complete);
  const failed = searches.some((search) => search.status === "error");
  return (
    <section className="cc-panel cc-loop-settings" aria-label={`${settings.title} settings`}>
      <h3 className="cc-heading">{settings.title}</h3>
      <p className="cc-muted">{settings.description}</p>
      <label>
        Maximum cycle length
        <input
          className="cc-select"
          type="number"
          min={1}
          step={1}
          aria-label="Maximum cycle length"
          value={length === Infinity ? "" : length}
          placeholder="Unlimited"
          disabled={length === Infinity}
          onChange={(event) => {
            const n = Number(event.target.value);
            if (Number.isSafeInteger(n) && n > 0) setLength(n);
          }}
        />
      </label>
      <label className="cc-check">
        <input
          type="checkbox"
          checked={length === Infinity}
          onChange={(event) => setLength(
            event.target.checked ? Infinity : Number.isFinite(settings.maxLength) ? settings.maxLength : 4,
          )}
        />
        No length limit
      </label>
      <p className="cc-muted">
        Up to {settings.limit} cycles per search, shortest first. Longer searches may take time.
      </p>
      {running && !paused && <button type="button" className="cc-button" onClick={() => setPaused(true)}>Cancel calculation</button>}
      {paused ? <>
        <button type="button" className="cc-button" onClick={() => setPaused(false)}>Resume calculation</button>
        <p role="status">Calculation cancelled.</p>
      </> : running ? <p role="status">Calculating…</p>
        : failed ? <p role="status">Calculation failed. Change the length to retry.</p>
        : finished.length > 0 ? <p role="status">{count}{incomplete ? "+" : ""} cycles · Longest search: {formatSearchTime(elapsed)}</p>
        : null}

    </section>
  );
}

export type LoopSearchStatus = "searching" | "complete" | "cancelled" | "error" | "idle";
export const formatSearchTime = (ms: number) => ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
const empty: LoopSearch = { loops: [], complete: false };

/** Worker lifetime is tied to the exact input. Old replies never replace a newer search. */
export function useLoopSearch(snapshot: Snapshot | null, options?: LoopOptions) {
  const context = useContext(LoopContext);
  const maxLength = context?.length ?? options?.maxLength ?? 4;
  const limit = options?.limit ?? context?.settings.limit ?? 1000;
  const through = options?.through;
  const paused = context?.paused ?? false;
  const report = context?.report;
  const [cancelled, setCancelled] = useState<object | null>(null);
  const input = useMemo(
    () => ({ snapshot, maxLength, limit, through }),
    [snapshot, maxLength, limit, through],
  );
  const [state, setState] = useState<{
    input: object;
    result: LoopSearch;
    status: LoopSearchStatus;
    error?: string;
    elapsedMs?: number;
  } | null>(null);
  const stopped = paused || cancelled === input;

  useEffect(() => {
    if (!snapshot || stopped) return;
    setState(null);
    const started = performance.now();
    const key = {};
    report?.(key, { status: "searching", cycles: [], elapsedMs: 0, complete: false });
    let worker: Worker | undefined;
    let live = true;
    const fail = (error: string) => {
      if (live) {
        setState({ input, result: empty, status: "error", error });
        report?.(key, { status: "error", cycles: [], elapsedMs: performance.now() - started, complete: false });
      }
      worker?.terminate();
    };
    try {
      worker = new Worker(new URL("./loop.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => {
        if (!live) return;
        if (data.error) fail(data.error);
        else {
          const elapsedMs = performance.now() - started;
          const result = data.result as LoopSearch;
          setState({ input, result, status: "complete", elapsedMs });
          report?.(key, {
            status: "complete", elapsedMs, complete: result.complete,
            cycles: result.loops.map((loop) => JSON.stringify([snapshot.id, [...loop.edges].sort()])),
          });
          worker?.terminate();
        }
      };
      worker.onerror = () => fail("Cycle search could not run. Try again.");
      worker.onmessageerror = () => fail("Cycle search returned an unreadable result. Try again.");
      worker.postMessage({ snapshot, options: { maxLength, limit, through } });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
    return () => {
      live = false;
      report?.(key, null);
      worker?.terminate();
    };
  }, [input, snapshot, maxLength, limit, through, stopped, report]);

  const current = state?.input === input ? state : null;
  const status: LoopSearchStatus = !snapshot ? "idle" : stopped ? "cancelled" : current?.status ?? "searching";
  return {
    ...(status === "complete" ? current!.result : empty),
    status,
    error: current?.error,
    elapsedMs: status === "complete" ? current?.elapsedMs : undefined,
    cancel: () => context ? context.setPaused(true) : setCancelled(input),
  };
}
