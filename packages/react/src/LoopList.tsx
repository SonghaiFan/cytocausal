"use client";
import { useMemo, useState } from "react";
import type { FeedbackLoop, Snapshot } from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";
import { formatSearchTime, type LoopSearchStatus } from "./LoopSearch.tsx";
import { RouteButton } from "./RouteButton.tsx";

export interface LoopListProps {
  hideHeading?: boolean;
  elapsedMs?: number;
  status?: LoopSearchStatus;
  error?: string;
  onCancel?: () => void;
  snapshot?: Snapshot;
  loops?: FeedbackLoop[];
  active?: Route | null;
  onToggle?: (route: Route) => void;
  /** Called with a loop while it's hovered or focused, and null afterwards. */
  onPreview?: (route: Route | null) => void;
  /** Heading text. The default shows the number of loops. */
  title?: string;
  /** False if a limit may have hidden some loops. */
  complete?: boolean;
  /** Leave out the panel around the list, to nest it in another panel. */
  bare?: boolean;
  className?: string;
}

const count = (loops: FeedbackLoop[], type: FeedbackLoop["type"]) =>
  loops.filter((loop) => loop.type === type).length;

/** Lists feedback loops, marked reinforcing or balancing, for choosing one to highlight. */
export function LoopList({
  hideHeading = false,
  elapsedMs: givenElapsed,
  status: givenStatus,
  error,
  onCancel,
  snapshot: given,
  loops: givenLoops,
  active,
  onToggle,
  onPreview,
  title,
  complete: givenComplete,
  bare = false,
  className = "",
}: LoopListProps) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const snapshot = required(given ?? causal?.snapshot, "LoopList", "snapshot");
  const loops = required(givenLoops ?? causal?.loops, "LoopList", "loops");
  const complete = givenComplete ?? (givenLoops ? true : causal?.loopsComplete);
  const names = useMemo(() => new Map(snapshot.nodes.map(node => [node.id, node.label])), [snapshot.nodes]);
  const labelOf = (id: string) => names.get(id) ?? id;
  const [page, setPage] = useState<{ loops: FeedbackLoop[]; count: number } | null>(null);
  const visibleCount = page?.loops === loops ? page.count : 25;
  const shownLoops = loops.slice(0, visibleCount);
  const typed = loops.some((loop) => loop.type !== "unknown");
  const status = givenStatus ?? (givenLoops ? "complete" : causal?.loopSearch.status) ?? "complete";
  const elapsedMs = givenElapsed ?? (givenLoops ? undefined : causal?.loopSearch.elapsedMs);
  const heading = `${title ?? labels.loops}${status === "complete" ? ` (${loops.length}${complete ? "" : "+"})` : ""}`;

  return (
    <section
      aria-label={`Loops in ${snapshot.id}`}
      className={`${bare ? "" : "cc-panel"} ${className}`}
    >
      {!hideHeading && <h3 className="cc-heading">{heading}</h3>}
      {status === "complete" && elapsedMs !== undefined && <p role="status" className="cc-muted">{loops.length}{complete ? "" : "+"} cycles · {formatSearchTime(elapsedMs)}</p>}
      {status !== "complete" ? (
        <p role="status" className="cc-muted">
          {status === "searching" ? "Calculating…" : status === "cancelled" ? "Calculation cancelled." : status === "error" ? (error ?? causal?.loopSearch.error ?? "Calculation failed.") : "Select a node to search."}
          {status === "searching" && <button type="button" className="cc-button" onClick={onCancel ?? causal?.loopSearch.cancel}>Cancel</button>}
        </p>
      ) : loops.length === 0 ? (
        <p className="cc-muted">{labels.noLoops}</p>
      ) : (
        <>
          {typed && (
            <p className="cc-muted">
              {labels.loopSummary(count(loops, "reinforcing"), count(loops, "balancing"))}
            </p>
          )}
          <ul className="cc-list">
            {shownLoops.map((loop) => (
              <li key={loop.edges.join()}>
                <RouteButton route={loop} active={active} onToggle={onToggle} onPreview={onPreview}>
                  {loop.type !== "unknown" && (
                    <span className="cc-badge" title={labels[loop.type]}>
                      <strong>{loop.type === "reinforcing" ? labels.reinforcingMark : labels.balancingMark}</strong>{" "}
                      {labels[loop.type]}
                    </span>
                  )}
                  {[...loop.nodes, loop.nodes[0]].map(labelOf).join(" → ")}
                </RouteButton>
              </li>
            ))}
          </ul>
          {visibleCount < loops.length && <button type="button" className="cc-link"
            onClick={() => setPage({ loops, count: visibleCount + 25 })}>
            Show more ({Math.min(visibleCount, loops.length)} / {loops.length})
          </button>}
        </>
      )}
    </section>
  );
}
