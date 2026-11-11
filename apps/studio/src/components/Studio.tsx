"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Core } from "cytoscape";
import type { CausalDataset, CausalEdge, Snapshot } from "@cytocausal/core";
import { savedLayout, relayout, autoLayout, type Positions } from "@cytocausal/cytoscape";
import { CausalWorkspace, GraphView, useCausalGraph, ZoomControls } from "@cytocausal/react";
import { deleteNode, emptyDataset, parseDataset, STORAGE_KEY } from "../model.ts";

const docs = process.env.NEXT_PUBLIC_DOCS_URL || "https://songhaifan.github.io/cytocausal/en/";
const download = (dataset: CausalDataset) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url;
  anchor.download = `${dataset.id.replace(/[^a-z0-9_-]/gi, "-") || "graph"}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const uid = (kind: string) => `${kind}:${crypto.randomUUID()}`;
const withPositions = (data: CausalDataset, version: string, positions: Positions): CausalDataset => ({
  ...data, snapshots: data.snapshots.map(snapshot => snapshot.id === version ? {
    ...snapshot, nodes: snapshot.nodes.map(node => ({ ...node, position: positions[node.id] ?? node.position })),
  } : snapshot),
});

export default function Studio() {
  const [dataset, setDataset] = useState<CausalDataset>(emptyDataset);
  const [version, setVersion] = useState("draft");
  const [mode, setMode] = useState<"edit" | "explore">("edit");
  const [status, setStatus] = useState("Saved on this browser after your first edit.");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [nodeName, setNodeName] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [polarity, setPolarity] = useState("");
  const [past, setPast] = useState<CausalDataset[]>([]); const [future, setFuture] = useState<CausalDataset[]>([]);
  const cy = useRef<Core | null>(null);
  const positions = useRef<Positions>({});
  const current = useRef({ dataset, version }); current.current = { dataset, version };
  const graph = useCausalGraph({ maxSelected: 1 });
  const snapshot = dataset.snapshots.find(item => item.id === version) ?? dataset.snapshots[0];
  const node = snapshot.nodes.find(item => item.id === graph.selected[0]);
  const edge = snapshot.edges.find(item => item.id === graph.selectedLink);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) { const restored = parseDataset(JSON.parse(stored)); setDataset(restored); setVersion(restored.snapshots[0].id); setStatus("Restored from this browser."); }
    } catch { setError("Could not restore saved data. It has not been overwritten. Import a backup or start a new graph."); }
  }, []);
  useEffect(() => {
    if (!revision) return;
    setStatus("Saving…");
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(withPositions(dataset, snapshot.id, positions.current))); setStatus("Saved in this browser."); }
      catch { setError("Browser storage is unavailable or full. Export JSON to keep your work."); setStatus("Not saved — export a backup."); }
    }, 250);
    return () => clearTimeout(timer);
  }, [dataset, revision, snapshot.id]);
  useEffect(() => {
    const save = () => {
      if (!revision) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(withPositions(current.current.dataset, current.current.version, positions.current))); } catch { /* The visible save status handles storage errors. */ }
    };
    window.addEventListener("pagehide", save); return () => window.removeEventListener("pagehide", save);
  }, [revision]);

  const commit = (next: CausalDataset) => {
    setPast(items => [...items.slice(-49), withPositions(dataset, snapshot.id, positions.current)]); setFuture([]);
    setDataset(next); setRevision(value => value + 1); setError("");
  };
  const changeSnapshot = (update: (s: Snapshot) => Snapshot) => {
    const positioned = withPositions(dataset, snapshot.id, positions.current);
    commit({ ...positioned, snapshots: positioned.snapshots.map(s => s.id === snapshot.id ? update(s) : s) });
  };
  const applyHistory = (next: CausalDataset) => {
    positions.current = {}; setDataset(next); setVersion(next.snapshots.some(s => s.id === version) ? version : next.snapshots[0].id);
    graph.clear(); setRevision(value => value + 1); setError("");
  };
  const connect = (instance: Core) => {
    cy.current = instance; graph.attach(instance);
    const capture = () => { positions.current = Object.fromEntries(instance.nodes().map(n => [n.id(), { ...n.position() }])); };
    capture(); instance.on("layoutstop", capture);
    instance.on("dragfree", "node", () => { capture(); setRevision(value => value + 1); });
  };
  const addNode = (event: FormEvent) => {
    event.preventDefault(); if (!nodeName.trim()) return;
    const extent = cy.current?.extent(); const n = snapshot.nodes.length;
    const position = extent ? { x: (extent.x1 + extent.x2) / 2 + (n % 3 - 1) * 90, y: (extent.y1 + extent.y2) / 2 + (Math.floor(n / 3) % 3 - 1) * 65 } : { x: n * 100, y: 0 };
    changeSnapshot(s => ({ ...s, nodes: [...s.nodes, { id: uid("node"), label: nodeName.trim(), position }] })); setNodeName("");
  };
  const addEdge = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot.nodes.some(n => n.id === from) || !snapshot.nodes.some(n => n.id === to)) { setError("Choose both a cause and an effect."); return; }
    const sign = polarity === "positive" || polarity === "negative" ? polarity : undefined;
    changeSnapshot(s => ({ ...s, edges: [...s.edges, { id: uid("edge"), source: from, target: to, polarity: sign }] }));
  };
  const imported = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseDataset(JSON.parse(await file.text()));
      if ((snapshot.nodes.length || snapshot.edges.length) && !confirm("Replace this graph with the imported dataset? You can undo this.")) return;
      positions.current = {}; commit(parsed); setVersion(parsed.snapshots[0].id); graph.clear();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not import JSON."); }
  };
  const switchMode = () => {
    if (mode === "edit") setDataset(withPositions(dataset, snapshot.id, positions.current));
    setMode(mode === "edit" ? "explore" : "edit"); graph.clear();
  };

  return <div className="studio">
    <header className="studio-header">
      <a className="studio-brand" href={docs}><img src="/mark.svg" width="32" height="32" alt="" /><img src="/wordmark.svg" width="156" height="30" alt="cytocausal" /><span>Studio</span></a>
      <div className="studio-tools">
        <button onClick={() => { if (!confirm("Start a new graph? Export a backup first. You can undo this.")) return; positions.current = {}; commit(emptyDataset()); setVersion("draft"); graph.clear(); }}>New graph</button>
        <label className="file-button">Import JSON<input type="file" accept=".json,application/json" onChange={e => { void imported(e.target.files?.[0]); e.target.value = ""; }} /></label>
        <button onClick={() => download(withPositions(dataset, snapshot.id, positions.current))}>Export JSON</button>
        <a href={docs}>Docs ↗</a>
      </div>
    </header>
    <div className="studio-bar">
      <label className="graph-title">Graph name<input aria-label="Graph name" value={dataset.id} onChange={e => { const id = e.target.value; if (id.trim()) commit({ ...dataset, id }); }} /></label>
      <span role="status" className="save-status">{status}</span>
      <button disabled={!past.length} onClick={() => { const previous = past.at(-1)!; setPast(past.slice(0, -1)); setFuture([...future, dataset]); applyHistory(previous); }}>Undo</button>
      <button disabled={!future.length} onClick={() => { const next = future.at(-1)!; setFuture(future.slice(0, -1)); setPast([...past, dataset]); applyHistory(next); }}>Redo</button>
      <button className="primary" onClick={switchMode}>{mode === "edit" ? "Explore graph" : "Back to editing"}</button>
    </div>
    {error && <div role="alert" className="studio-error">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    {mode === "explore" ? <div className="studio-explore"><CausalWorkspace dataset={dataset} initialVersion={snapshot.id} title={dataset.id} shareInUrl={false} /><p className="explore-note">Explore mode · changes to selection do not edit your graph.</p></div> : <main className="studio-main">
      <section className="studio-canvas" aria-label="Drawing canvas">
        <GraphView dataset={dataset} snapshotId={snapshot.id} layout={snapshot.nodes.every(n => n.position) ? savedLayout : autoLayout} onReady={connect} />
        {!snapshot.nodes.length && <div className="empty-canvas"><img src="/mark.svg" alt="" width="72" height="72" /><h1>Start with a cause.</h1><p>Add two variables, connect them, then explore what follows.</p></div>}
        <div className="canvas-controls"><span>{snapshot.nodes.length} nodes · {snapshot.edges.length} links</span><button disabled={!snapshot.nodes.length} onClick={() => cy.current && relayout(cy.current, autoLayout, { onSettled: () => { if (cy.current) positions.current = Object.fromEntries(cy.current.nodes().map(n => [n.id(), { ...n.position() }])); setRevision(v => v + 1); } })}>Arrange</button><ZoomControls graph={graph} /></div>
      </section>
      <aside className="studio-inspector">
        {dataset.snapshots.length > 1 && <label>Snapshot<select aria-label="Snapshot" value={snapshot.id} onChange={e => { setDataset(withPositions(dataset, snapshot.id, positions.current)); positions.current = {}; setVersion(e.target.value); graph.clear(); }}>{dataset.snapshots.map(s => <option key={s.id}>{s.id}</option>)}</select></label>}
        <form onSubmit={addNode}><h2>Add a variable</h2><label>Name<input value={nodeName} onChange={e => setNodeName(e.target.value)} placeholder="e.g. Demand" required /></label><button className="primary" type="submit">Add node</button></form>
        <form onSubmit={addEdge}><h2>Connect cause to effect</h2><label>Cause<select value={from} onChange={e => setFrom(e.target.value)} required><option value="">Choose a node</option>{snapshot.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Effect<select value={to} onChange={e => setTo(e.target.value)} required><option value="">Choose a node</option>{snapshot.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>Polarity<select value={polarity} onChange={e => setPolarity(e.target.value)}><option value="">Unknown</option><option value="positive">+ Positive</option><option value="negative">− Negative</option></select></label><button type="submit" disabled={!snapshot.nodes.length}>Add link</button><p className="hint">Positive: changes in the same direction. Negative: opposite direction.</p></form>
        <section><h2>Edit selection</h2>{node ? <form key={node.id + node.label} onSubmit={event => { event.preventDefault(); const label = String(new FormData(event.currentTarget).get("label")).trim(); if (label) changeSnapshot(s => ({ ...s, nodes: s.nodes.map(n => n.id === node.id ? { ...n, label } : n) })); }}><label>Node label<input name="label" defaultValue={node.label} required /></label><button type="submit">Save label</button><button type="button" className="danger" onClick={() => { commit(deleteNode(withPositions(dataset, snapshot.id, positions.current), snapshot.id, node.id)); graph.clear(); }}>Delete node and its links</button></form> : edge ? <form key={edge.id + edge.polarity} onSubmit={event => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("polarity")); changeSnapshot(s => ({ ...s, edges: s.edges.map(e => e.id === edge.id ? { ...e, polarity: (value || undefined) as CausalEdge["polarity"] } : e) })); }}><p>{snapshot.nodes.find(n => n.id === edge.source)?.label} → {snapshot.nodes.find(n => n.id === edge.target)?.label}</p><label>Link polarity<select name="polarity" defaultValue={edge.polarity || ""}><option value="">Unknown</option><option value="positive">+ Positive</option><option value="negative">− Negative</option></select></label><button type="submit">Save polarity</button><button type="button" className="danger" onClick={() => { changeSnapshot(s => ({ ...s, edges: s.edges.filter(e => e.id !== edge.id) })); graph.clear(); }}>Delete link</button></form> : <p className="hint">Select a node or link on the canvas, or in the list below.</p>}</section>
        <details><summary>Nodes and links</summary><ul className="element-list">{snapshot.nodes.map(n => <li key={n.id}><button onClick={() => graph.focus(n.id)}>{n.label}</button></li>)}{snapshot.edges.map(e => <li key={e.id}><button onClick={() => graph.toggleLink(e.id)}>{snapshot.nodes.find(n => n.id === e.source)?.label} → {snapshot.nodes.find(n => n.id === e.target)?.label}</button></li>)}</ul></details>
        <p className="hint privacy">Your graph stays in this browser. Export JSON for a backup or to move it to another device. No account or cloud sync.</p>
      </aside>
    </main>}
  </div>;
}
