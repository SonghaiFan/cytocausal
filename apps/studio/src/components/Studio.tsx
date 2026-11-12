"use client";
import { useEffect, useRef, useState } from "react";
import { CausalEditor, type CausalEditorApi, type EditorNodeStyle } from "@cytocausal/react";
import type { CausalDataset } from "@cytocausal/core";
import { emptyDataset, parseDataset, STORAGE_KEY } from "../model.ts";

const docs = process.env.NEXT_PUBLIC_DOCS_URL || "https://songhaifan.github.io/cytocausal/en/";
const NODE_STYLE_KEY = "cytocausal-studio-node-style";
const download = (dataset: CausalDataset) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `${dataset.id.replace(/[^a-z0-9_-]/gi, "-") || "graph"}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function GraphName({ editor }: { editor: CausalEditorApi }) {
  const name = editor.getDataset().id;
  const [title, setTitle] = useState(name);
  useEffect(() => setTitle(name), [name]);
  return <label className="graph-title">Graph name<input aria-label="Graph name" value={title} onChange={e => setTitle(e.target.value)}
    onBlur={() => { if (title.trim()) editor.renameDataset(title); else setTitle(name); }}
    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>;
}

export default function Studio() {
  const [initial, setInitial] = useState<{ dataset: CausalDataset; style: EditorNodeStyle } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Saved in this browser after your first edit.");
  const [changed, setChanged] = useState<CausalDataset | null>(null);
  const editor = useRef<CausalEditorApi>(null);
  const pending = useRef<CausalDataset | null>(null);
  useEffect(() => {
    let dataset = emptyDataset(); let style: EditorNodeStyle = "text";
    try { if (localStorage.getItem(NODE_STYLE_KEY) === "dot") style = "dot"; } catch { /* Optional preference */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { dataset = parseDataset(JSON.parse(raw)); setStatus("Saved in this browser."); }
    } catch { setError("Could not restore saved data. It has not been overwritten. Import a backup or start a new graph."); }
    setInitial({ dataset, style });
  }, []);
  useEffect(() => {
    if (!changed) return;
    setStatus("Saving…");
    const save = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pending.current)); setStatus("Saved in this browser."); }
      catch { setStatus("Not saved — export a backup."); setError("Browser storage is unavailable or full. Export JSON to keep your work."); }
    };
    const timer = setTimeout(save, 250); window.addEventListener("pagehide", save);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", save); };
  }, [changed]);
  const imported = async (api: CausalEditorApi, file?: File) => {
    if (!file) return;
    try {
      const data = parseDataset(JSON.parse(await file.text()));
      if (api.getDataset().snapshots.some(s => s.nodes.length) && !confirm("Replace this graph with the imported dataset? You can undo this.")) return;
      api.replaceDataset(data); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not import JSON."); }
  };
  if (!initial) return <p className="loading">Opening your canvas…</p>;
  return <CausalEditor ref={editor} className="studio" initialDataset={initial.dataset} initialNodeStyle={initial.style}
    onChange={data => { pending.current = data; setStatus("Saving…"); setChanged(data); }}
    onNodeStyleChange={style => { try { localStorage.setItem(NODE_STYLE_KEY, style); } catch { /* Optional preference */ } }}
    header={api => <><header className="studio-header"><a className="studio-brand" href={docs}><img src="/mark.svg" width="32" height="32" alt="" /><img src="/wordmark.svg" width="138" height="30" alt="cytocausal" /><span>Studio</span></a><div className="studio-tools">
      <button onClick={() => { if (confirm("Start a new graph? You can undo this.")) { api.replaceDataset(emptyDataset()); setError(""); } }}>New graph</button>
      <label className="file-button">Import JSON<input type="file" accept=".json,application/json" onChange={e => { void imported(api, e.target.files?.[0]); e.target.value = ""; }} /></label>
      <button onClick={() => download(api.getDataset())}>Export JSON</button><a href={docs}>Docs ↗</a>
    </div></header>{error && <div role="alert" className="studio-error">{error}<button onClick={() => setError("")}>Dismiss</button></div>}</>}
    toolbar={api => <><GraphName editor={api}/><span role="status" className="save-status">{status}</span></>}
  />;
}
