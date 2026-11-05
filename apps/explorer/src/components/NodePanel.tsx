import type { CausalNode } from "@cytocausal/core";
import { CAUSE_COLOR, EFFECT_COLOR } from "@/graph-style";

function NodeLinks({
  title,
  color,
  nodes,
  onSelect,
}: {
  title: string;
  color: string;
  nodes: CausalNode[];
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-sm font-semibold" style={{ color }}>
        {title} ({nodes.length})
      </h4>
      <ul className="max-h-32 overflow-auto">
        {nodes.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className="w-full text-left text-sm p-0.5 rounded hover:bg-gray-100"
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shows a selected node's sentences and direct causes and effects. */
export function NodePanel({
  node,
  causes,
  effects,
  onSelect,
  onClose,
}: {
  node: CausalNode;
  causes: CausalNode[];
  effects: CausalNode[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const sentences = node.evidence ?? [];
  return (
    <section className="bg-white border rounded-md shadow p-3" aria-label={`Node ${node.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">Cluster {node.id}</p>
          <h3 className="font-semibold">{node.label}</h3>
        </div>
        <button
          type="button"
          aria-label={`Close cluster ${node.id}`}
          onClick={onClose}
          className="text-gray-500 hover:text-gray-900 px-1"
        >
          ×
        </button>
      </div>
      <NodeLinks title="Caused by" color={CAUSE_COLOR} nodes={causes} onSelect={onSelect} />
      <NodeLinks title="Leads to" color={EFFECT_COLOR} nodes={effects} onSelect={onSelect} />
      <h4 className="text-sm font-semibold mt-3">Sentences ({sentences.length})</h4>
      <ul className="list-disc ml-4 text-sm text-gray-700 max-h-64 overflow-auto">
        {sentences.map(({ id, text }, index) => (
          <li key={`${id}-${index}`}>{text}</li>
        ))}
      </ul>
    </section>
  );
}
