"use client";
import { useRef, useState } from "react";
import type { CausalDataset } from "@cytocausal/core";
import { CausalEditor, type CausalEditorApi } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import "@cytocausal/react/editor.css";

const initialDataset: CausalDataset = {
  id: "Coffee shop",
  snapshots: [{
    id: "draft",
    nodes: [
      { id: "demand", label: "Demand", position: { x: 100, y: 150 } },
      { id: "production", label: "Production", position: { x: 400, y: 150 } },
    ],
    edges: [{ id: "demand-production", source: "demand", target: "production", polarity: "positive" }],
  }],
};

/** Only public package imports. A host can send onChange data to its own persistence layer. */
export function EditorExample({ title = "Primary editor" }: { title?: string }) {
  const editor = useRef<CausalEditorApi>(null);
  const [document, setDocument] = useState(initialDataset);
  const [changes, setChanges] = useState(0);
  return <section aria-label={title} style={{ height: 760, marginBottom: 24, border: "1px solid #ddd" }}>
    <CausalEditor ref={editor} initialDataset={initialDataset}
      onChange={next => { setDocument(next); setChanges(count => count + 1); }}
      header={() => <header style={{ padding: 12 }}>
        <strong>{title}</strong> · <output aria-label="Document changes">{changes} changes</output>
        <p>Changes are held by this React component. Reloading resets the example.</p>
        <button onClick={() => { editor.current?.replaceDataset(initialDataset, { resetHistory: true }); setDocument(initialDataset); }}>Reload original</button>
        <button onClick={() => {
          const next = { ...initialDataset, id: "Replacement", snapshots: [{ id: "replacement", nodes: [{ id: "fresh", label: "Fresh variable", position: { x: 240, y: 150 } }], edges: [] }] };
          editor.current?.replaceDataset(next, { resetHistory: true });
          setDocument(next);
        }}>Load another document</button>
        <span aria-label="Host document">{document.id}</span>
      </header>}
    />
  </section>;
}

export function EditorExamples() {
  const [second, setSecond] = useState(false);
  return <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
    <h1>React authoring example</h1>
    <button onClick={() => setSecond(value => !value)}>{second ? "Remove second editor" : "Add second editor"}</button>
    <EditorExample />
    {second && <EditorExample title="Second editor" />}
  </main>;
}
