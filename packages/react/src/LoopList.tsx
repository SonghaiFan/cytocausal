"use client";
import type { FeedbackLoop, Snapshot } from "@cytocausal/core";
import type { Route } from "@cytocausal/cytoscape";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";
import { RouteButton } from "./RouteButton.tsx";

export interface LoopListProps {
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
  const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)?.label ?? id;
  const typed = loops.some((loop) => loop.type !== "unknown");
  const heading = title ?? `${labels.loops} (${loops.length}${complete ? "" : "+"})`;

  return (
    <section
      aria-label={`Loops in ${snapshot.id}`}
      className={`${bare ? "" : "cc-panel"} ${className}`}
    >
      <h3 className="cc-heading">{heading}</h3>
      {loops.length === 0 ? (
        <p className="cc-muted">{labels.noLoops}</p>
      ) : (
        <>
          {typed && (
            <p className="cc-muted">
              {labels.loopSummary(count(loops, "reinforcing"), count(loops, "balancing"))}
            </p>
          )}
          <ul className="cc-list">
            {loops.map((loop) => (
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
        </>
      )}
    </section>
  );
}
