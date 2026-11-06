"use client";
import { searchNodes, type CausalNode } from "@cytocausal/core";
import { useMemo, useState } from "react";
import { required, useOptionalCausal } from "./CausalProvider.tsx";
import { useCausalLabels } from "./labels.tsx";

export interface NodeSearchProps {
  nodes?: CausalNode[];
  onSelect?: (id: string) => void;
  placeholder?: string;
  /** Results to show. The match count still covers all of them. */
  limit?: number;
  className?: string;
}

/** A search box for node ids, labels and evidence, with a list of results to choose from. */
export function NodeSearch({
  nodes: given,
  onSelect: chosen,
  placeholder,
  limit = 30,
  className = "",
}: NodeSearchProps) {
  const labels = useCausalLabels();
  const causal = useOptionalCausal();
  const nodes = required(given ?? causal?.snapshot.nodes, "NodeSearch", "nodes");
  const onSelect = required(chosen ?? causal?.graph.focus, "NodeSearch", "onSelect");
  const prompt = placeholder ?? labels.search;
  const [text, setText] = useState("");
  const results = useMemo(() => searchNodes(nodes, text), [nodes, text]);

  return (
    <section className={`cc-panel cc-search ${className}`}>
      <input
        type="search"
        className="cc-input"
        aria-label={prompt.replace(/…$/, "")}
        placeholder={prompt}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {text.trim() && (
        <>
          <p role="status" className="cc-muted">
            {labels.matches(results.length)}
          </p>
          <ul className="cc-list">
            {results.slice(0, limit).map(({ node, evidence }) => (
              <li key={node.id}>
                <button type="button" className="cc-row" onClick={() => onSelect(node.id)}>
                  {node.label}
                  {evidence && <span className="cc-muted cc-quote">“{evidence}”</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
