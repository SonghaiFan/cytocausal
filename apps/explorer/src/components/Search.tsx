import type { CausalNode } from "@cytocausal/core";
import { useMemo, useState } from "react";

const MAX_RESULTS = 30;

type Result = { node: CausalNode; sentence?: string };

function search(nodes: CausalNode[], text: string): Result[] {
  const query = text.trim().toLowerCase();
  if (query.length < 2) return [];
  const results: Result[] = [];
  const inSentences: Result[] = [];
  for (const node of nodes) {
    if (node.id === query || node.label.toLowerCase().includes(query)) {
      results.push({ node });
      continue;
    }
    const match = node.evidence?.find((item) => item.text.toLowerCase().includes(query));
    if (match) inSentences.push({ node, sentence: match.text });
  }
  return [...results, ...inSentences];
}

/** Finds nodes by id, label or any of their sentences. */
export function Search({
  nodes,
  onSelect,
}: {
  nodes: CausalNode[];
  onSelect: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const results = useMemo(() => search(nodes, text), [nodes, text]);

  return (
    <section className="bg-white border rounded-md shadow p-3">
      <input
        type="search"
        aria-label="Search nodes and sentences"
        placeholder="Search nodes and sentences…"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full border rounded px-2 py-1"
      />
      {text.trim().length >= 2 && (
        <>
          <p className="text-xs text-gray-500 mt-2" role="status">
            {results.length} {results.length === 1 ? "match" : "matches"}
          </p>
          <ul className="max-h-56 overflow-auto mt-1">
            {results.slice(0, MAX_RESULTS).map(({ node, sentence }) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onSelect(node.id)}
                  className="w-full text-left p-1 rounded hover:bg-gray-100 text-sm"
                >
                  {node.label}
                  {sentence && <span className="block text-xs text-gray-500">“{sentence}”</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
