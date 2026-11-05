"use client";
import { searchNodes, type CausalNode } from "@cytocausal/core";
import { useMemo, useState } from "react";

export interface NodeSearchProps {
  nodes: CausalNode[];
  onSelect: (id: string) => void;
  placeholder?: string;
  /** Results to show. The match count still covers all of them. */
  limit?: number;
  className?: string;
}

const resultStyle = {
  display: "block",
  width: "100%",
  padding: "0.25rem",
  border: 0,
  background: "none",
  font: "inherit",
  fontSize: "0.875rem",
  textAlign: "left",
  cursor: "pointer",
} as const;

/** A search box for node ids, labels and evidence, with a list of results to choose from. */
export function NodeSearch({
  nodes,
  onSelect,
  placeholder = "Search nodes…",
  limit = 30,
  className,
}: NodeSearchProps) {
  const [text, setText] = useState("");
  const results = useMemo(() => searchNodes(nodes, text), [nodes, text]);

  return (
    <section className={className}>
      <input
        type="search"
        aria-label={placeholder.replace(/…$/, "")}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        style={{ width: "100%", padding: "0.25rem 0.5rem", font: "inherit" }}
      />
      {text.trim() && (
        <>
          <p role="status" style={{ margin: "0.5rem 0 0.25rem", fontSize: "0.75rem", opacity: 0.7 }}>
            {results.length} {results.length === 1 ? "match" : "matches"}
          </p>
          <ul style={{ maxHeight: "14rem", margin: 0, padding: 0, overflow: "auto", listStyle: "none" }}>
            {results.slice(0, limit).map(({ node, evidence }) => (
              <li key={node.id}>
                <button type="button" onClick={() => onSelect(node.id)} style={resultStyle}>
                  {node.label}
                  {evidence && (
                    <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.7 }}>
                      “{evidence}”
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
