"use client";
import type { FeedbackLoop, Snapshot } from "@cytocausal/core";
import { useCausalLabels } from "./labels.tsx";

export interface LoopListProps {
  snapshot: Snapshot;
  loops: FeedbackLoop[];
  active?: FeedbackLoop | null;
  onToggle: (loop: FeedbackLoop) => void;
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
  snapshot,
  loops,
  active,
  onToggle,
  title,
  complete = true,
  bare = false,
  className = "",
}: LoopListProps) {
  const labels = useCausalLabels();
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
                <button
                  type="button"
                  className="cc-row"
                  aria-pressed={active === loop}
                  onClick={() => onToggle(loop)}
                >
                  {loop.type !== "unknown" && (
                    <span className={`cc-badge cc-badge-${loop.type}`}>{labels[loop.type]}</span>
                  )}
                  {[...loop.nodes, loop.nodes[0]].map(labelOf).join(" → ")}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
