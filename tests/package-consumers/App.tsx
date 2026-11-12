"use client";
import { useState } from "react";
import { CausalEditor } from "@cytocausal/react";
import { createEmptyDataset, type CausalDataset } from "@cytocausal/core";
import "@cytocausal/react/styles.css";
import "@cytocausal/react/editor.css";

const dataset: CausalDataset = {
  ...createEmptyDataset(),
  id: "Packed consumer",
  snapshots: [{
    id: "draft",
    nodes: Array.from({ length: 60 }, (_, i) => ({ id: "n" + i, label: "Variable " + i })),
    edges: Array.from({ length: 60 }, (_, i) => ({
      id: "e" + i, source: "n" + i, target: "n" + ((i + 1) % 60), polarity: "positive" as const,
    })),
  }],
};
export default function App() {
  const [changes, setChanges] = useState(0);
  return <div style={{ height: "100vh" }}>
    <CausalEditor initialDataset={dataset}
      onChange={() => setChanges(n => n + 1)}
      header={() => <output aria-label="Changes">{changes}</output>}
    />
  </div>;
}
