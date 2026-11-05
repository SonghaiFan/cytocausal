import type { FeedbackLoop, Snapshot } from "@cytocausal/core";

const badge = {
  reinforcing: { letter: "R", title: "Reinforcing", className: "bg-red-100 text-red-800" },
  balancing: { letter: "B", title: "Balancing", className: "bg-blue-100 text-blue-800" },
  unknown: { letter: "?", title: "Unknown", className: "bg-gray-100 text-gray-800" },
};

const countOf = (loops: FeedbackLoop[], type: FeedbackLoop["type"]) =>
  loops.filter((loop) => loop.type === type).length;

/** Lists the feedback loops of each graph on screen, and highlights the one chosen. */
export function LoopPanel({
  groups,
  active,
  onToggle,
}: {
  groups: { snapshot: Snapshot; loops: FeedbackLoop[] }[];
  active: { snapshotId: string; loop: FeedbackLoop } | null;
  onToggle: (snapshotId: string, loop: FeedbackLoop) => void;
}) {
  return (
    <div className="bg-white border rounded-md p-2 mb-8 shadow-lg">
      <h4 className="text-lg font-semibold mb-2">Feedback Loops</h4>
      {groups.map(({ snapshot, loops }) => {
        const labelOf = (id: string) => snapshot.nodes.find((node) => node.id === id)!.label;
        return (
          <section key={snapshot.id} aria-label={`Loops in ${snapshot.id}`} className="mb-3">
            {groups.length > 1 && <h5 className="font-semibold text-sm">{snapshot.id}</h5>}
            {loops.length === 0 ? (
              <p className="text-sm text-gray-500">No feedback loops</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-1">
                  {countOf(loops, "reinforcing")} reinforcing, {countOf(loops, "balancing")}{" "}
                  balancing
                </p>
                <ul className="max-h-48 overflow-auto">
                  {loops.map((loop) => {
                    const { letter, title, className } = badge[loop.type];
                    const selected = active?.loop === loop;
                    return (
                      <li key={loop.edges.join()}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onToggle(snapshot.id, loop)}
                          className={`flex w-full gap-1 text-left text-xs p-1 rounded hover:bg-gray-100 ${
                            selected ? "bg-gray-200" : ""
                          }`}
                        >
                          <span title={title} className={`shrink-0 self-start rounded px-1 font-bold ${className}`}>
                            {letter}
                          </span>
                          <span>{[...loop.nodes, loop.nodes[0]].map(labelOf).join(" → ")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
