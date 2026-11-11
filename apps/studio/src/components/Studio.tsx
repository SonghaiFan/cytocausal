"use client";
import { useEffect, useReducer, useRef, useState, type Dispatch, type MutableRefObject } from "react";
import type { Core, EventObject } from "cytoscape";
import type { CausalDataset, CausalEdge, Snapshot } from "@cytocausal/core";
import { savedLayout, autoLayout, relayout, keepConstantSize, lightTheme, darkTheme, type Positions } from "@cytocausal/cytoscape";
import { CausalProvider, DepthControl, GraphView, RadialMenu, ZoomControls, NodeSearch, CyclePanel, SelectionPanel, ContributorFilter, VersionDiff, useCausal } from "@cytocausal/react";
import { deleteNode, emptyDataset, parseDataset, STORAGE_KEY } from "../model.ts";
import { historyReducer, unselected, type DocumentState, type History, type HistoryAction, type Selection } from "../history.ts";
import { AuthorMenu, ringAround, type Direction } from "./AuthorMenu.tsx";

type Point = { x: number; y: number };
type View = { zoom: number; pan: Point };
type Connection = { origin: string; direction: Direction };
type Draft = { position: Point; label: string; node?: string; connection?: Connection };
const docs = process.env.NEXT_PUBLIC_DOCS_URL || "https://songhaifan.github.io/cytocausal/en/";
const studioThemes = { light: { ...lightTheme, colors: { ...lightTheme.colors, accent: "#fbc92b", ink: "#20201b", text: "#20201b" } }, dark: darkTheme };
/**
 * How a variable is drawn, for the whole graph. `text` holds the name inside the node, which suits
 * a diagram read whole, as Perspectiva draws it. `dot` puts the name beside a dot on straight
 * links, which suits a dense network, as Explorer draws it. One object each, so the graph is only
 * restyled when the choice changes.
 */
type NodeStyle = "text" | "dot";
const NODE_STYLE_KEY = "cytocausal-studio-node-style";
const studioStyles = { text: { node: "pill", link: "flowing", zoom: "spread" }, dot: { node: "dot", link: "straight", zoom: "spread" } } as const;
const uid = (kind: string) => `${kind}:${crypto.randomUUID()}`;
const positionsOf = (cy: Core): Positions => Object.fromEntries(cy.nodes().map(n => [n.id(), { ...n.position() }]));
const withPositions = (data: CausalDataset, version: string, positions: Positions): CausalDataset => ({
  ...data, snapshots: data.snapshots.map(s => s.id === version ? { ...s, nodes: s.nodes.map(n => ({ ...n, position: positions[n.id] ?? n.position })) } : s),
});
const download = (dataset: CausalDataset) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `${dataset.id.replace(/[^a-z0-9_-]/gi, "-") || "graph"}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function Studio() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({ present: { dataset: emptyDataset(), version: "draft", selection: unselected() }, past: [], future: [], revision: 0 }));
  const [loaded, setLoaded] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const viewport = useRef<View | null>(null);
  const [nodeStyle, setNodeStyle] = useState<NodeStyle>("text");
  const chooseNodeStyle = (next: NodeStyle) => { setNodeStyle(next); try { localStorage.setItem(NODE_STYLE_KEY, next); } catch { /* A preference only: the graph is unaffected */ } };
  useEffect(() => {
    try { if (localStorage.getItem(NODE_STYLE_KEY) === "dot") setNodeStyle("dot"); } catch { /* Storage may be unavailable */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const dataset = parseDataset(JSON.parse(raw)); dispatch({ type: "restore", document: { dataset, version: dataset.snapshots[0].id, selection: unselected() } }); }
    } catch { setRestoreError("Could not restore saved data. It has not been overwritten. Import a backup or start a new graph."); }
    setLoaded(true);
  }, []);
  if (!loaded) return <p className="loading">Opening your canvas…</p>;
  const { dataset, version, selection } = history.present;
  return <CausalProvider key={version} dataset={dataset} initialVersion={version} initialSelected={selection.nodes} initialLink={selection.link ?? undefined} scheme="light" themes={studioThemes} styleOptions={studioStyles[nodeStyle]} shareInUrl={false}>
    <Editor nodeStyle={nodeStyle} onNodeStyle={chooseNodeStyle} history={history} dispatch={dispatch} viewport={viewport} restoreError={restoreError} />
  </CausalProvider>;
}

function Editor({ nodeStyle, onNodeStyle, history, dispatch, viewport, restoreError }: { nodeStyle: NodeStyle; onNodeStyle: (next: NodeStyle) => void; history: History; dispatch: Dispatch<HistoryAction>; viewport: MutableRefObject<View | null>; restoreError: string }) {
  const { dataset, snapshot, version, graph, stylesheet, applyFilter, exportImage } = useCausal();
  const [mode, setMode] = useState<"author" | "explore">("author");
  const [error, setError] = useState(history.revision ? "" : restoreError);
  const [status, setStatus] = useState("Saved in this browser after your first edit.");
  const [menu, setMenu] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [quickEdge, setQuickEdge] = useState<string | null>(null);
  const [title, setTitle] = useState(dataset.id);
  const [, redraw] = useState(0);
  const canvas = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  const positions = useRef<Positions>({});
  const ready = useRef(false);
  const dragBefore = useRef<DocumentState | null>(null);
  const latest = useRef({ mode, connection, draft, menu }); latest.current = { mode, connection, draft, menu };
  const node = snapshot.nodes.find(n => n.id === graph.selected[0]);
  const edge = snapshot.edges.find(e => e.id === graph.selectedLink);
  const selected = (): Selection => ({ nodes: [...graph.selected], link: graph.selectedLink });
  const materialize = (): DocumentState => ({ dataset: withPositions(dataset, version, positions.current), version, selection: selected() });
  const current = useRef(materialize); current.current = materialize;
  const close = () => { setMenu(null); setConnection(null); setDraft(null); setPointer(null); setQuickEdge(null); };
  const focusCanvas = () => graph.cy.current?.container()?.focus();
  const selectNode = (id: string) => { graph.clear(); graph.toggle(id); };
  const commit = (data: CausalDataset, selection = selected(), before = materialize(), nextVersion = version) => {
    dispatch({ type: "commit", before, after: { dataset: data, version: nextVersion, selection } }); setError("");
  };
  const update = (fn: (s: Snapshot) => Snapshot, selection = selected(), before = materialize()) => {
    commit({ ...before.dataset, snapshots: before.dataset.snapshots.map(s => s.id === version ? fn(s) : s) }, selection, before);
  };
  const undo = (redo = false) => { close(); dispatch({ type: redo ? "redo" : "undo", current: materialize() }); };
  const rename = (id: string) => {
    const n = snapshot.nodes.find(n => n.id === id); if (!n) return;
    setMenu(null); setConnection(null); setQuickEdge(null);
    setDraft({ node: id, label: n.label, position: positions.current[id] ?? n.position ?? { x: 0, y: 0 } });
  };
  const beginConnection = (origin: string, direction: Direction) => {
    setMenu(null); setDraft(null); setQuickEdge(null); setConnection({ origin, direction }); setPointer(null); selectNode(origin); focusCanvas();
  };
  const createLink = (c: Connection, target: string, newNode?: { id: string; label: string; position: Point }) => {
    const source = c.direction === "effect" ? c.origin : target;
    const destination = c.direction === "effect" ? target : c.origin;
    if (!snapshot.nodes.some(n => n.id === c.origin) || (!newNode && !snapshot.nodes.some(n => n.id === target))) return;
    const existing = snapshot.edges.find(e => e.source === source && e.target === destination);
    if (existing) { close(); graph.clear(); graph.toggleLink(existing.id); setQuickEdge(existing.id); setError("This relationship already exists. You can edit its polarity."); return; }
    const id = uid("edge");
    update(s => ({ ...s, nodes: newNode ? [...s.nodes, newNode] : s.nodes, edges: [...s.edges, { id, source, target: destination }] }), { nodes: [target], link: null });
    close(); setQuickEdge(id);
  };
  /**
   * Dragging out of a side sector places the other end in one gesture: let go on a variable to link
   * it, or on empty canvas to name a new one there. A press without a drag leaves the link following
   * the pointer, to be placed with a click.
   */
  const dragOut = (origin: string, direction: Direction, start: Point) => {
    beginConnection(origin, direction);
    const local = (e: PointerEvent): Point => { const box = canvas.current!.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; };
    const move = (e: PointerEvent) => setPointer(local(e));
    const done = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", done); };
    const up = (e: PointerEvent) => {
      done();
      const cy = graph.cy.current; const box = canvas.current;
      if (!cy || !box || !latest.current.connection || Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) return;
      const p = local(e); if (p.x < 0 || p.y < 0 || p.x > box.clientWidth || p.y > box.clientHeight) return;
      const hit = cy.nodes().filter(n => { const b = n.renderedBoundingBox(); return p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2; }).last();
      if (hit.nonempty()) { if (hit.id() !== origin) handlers.current.createLink({ origin, direction }, hit.id()); }
      else setDraft({ label: "", position: { x: (p.x - cy.pan().x) / cy.zoom(), y: (p.y - cy.pan().y) / cy.zoom() }, connection: { origin, direction } });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", done);
  };
  const submitDraft = () => {
    if (!draft?.label.trim()) return;
    if (draft.node) update(s => ({ ...s, nodes: s.nodes.map(n => n.id === draft.node ? { ...n, label: draft.label.trim() } : n) }), { nodes: [draft.node], link: null });
    else {
      const n = { id: uid("node"), label: draft.label.trim(), position: draft.position };
      if (draft.connection) { createLink(draft.connection, n.id, n); focusCanvas(); return; }
      update(s => ({ ...s, nodes: [...s.nodes, n] }), { nodes: [n.id], link: null });
    }
    close(); focusCanvas();
  };
  const setPolarity = (id: string, polarity: CausalEdge["polarity"]) => {
    update(s => ({ ...s, edges: s.edges.map(e => e.id === id ? { ...e, polarity } : e) }));
  };
  const removeNode = (id: string) => { commit(deleteNode(materialize().dataset, version, id), unselected()); close(); focusCanvas(); };
  const screen = (p: Point): Point => { const cy = graph.cy.current; return cy ? { x: p.x * cy.zoom() + cy.pan().x, y: p.y * cy.zoom() + cy.pan().y } : p; };
  const place = (p: Point, width: number, height: number): Point => ({ x: Math.max(width / 2 + 8, Math.min((canvas.current?.clientWidth ?? 800) - width / 2 - 8, p.x)), y: Math.max(height / 2 + 8, Math.min((canvas.current?.clientHeight ?? 500) - height / 2 - 8, p.y)) });
  const centerPosition = (): Point => { const cy = graph.cy.current; const e = cy?.extent(); return e ? { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 } : { x: 0, y: 0 }; };
  /** Where a node is on the canvas, and half its larger side: what a ring around it needs. */
  const hubOf = (id: string) => {
    const n = graph.cy.current?.getElementById(id); if (!n?.length) return null;
    // A name beside a dot counts as part of it, so the ring goes around both and covers neither
    const at = n.renderedPosition(); const b = n.renderedBoundingBox({ includeLabels: true, includeOverlays: false });
    return { ...at, radius: Math.max(n.renderedOuterWidth() / 2, n.renderedOuterHeight() / 2, at.x - b.x1, b.x2 - at.x, at.y - b.y1, b.y2 - at.y) };
  };
  const openMenu = (id: string) => {
    close(); graph.finishMarking(null, null, undefined); selectNode(id); setMenu(id);
    // The ring stays on its node, so the camera makes room for it rather than the ring moving away
    const hub = hubOf(id); const box = canvas.current; if (!hub || !box) return;
    const reach = ringAround(hub.radius).outer;
    const shift = (at: number, margin: number, size: number) => size < margin * 2 ? size / 2 - at : at < margin ? margin - at : at > size - margin ? size - margin - at : 0;
    const by = { x: shift(hub.x, reach + 84, box.clientWidth), y: shift(hub.y, reach + 30, box.clientHeight) };
    if (by.x || by.y) graph.cy.current?.panBy(by);
  };
  const handlers = useRef({ openMenu, rename, createLink }); handlers.current = { openMenu, rename, createLink };

  useEffect(() => { setTitle(dataset.id); }, [dataset.id]);
  useEffect(() => { if (draft) { input.current?.focus(); input.current?.select(); } }, [draft?.node, !!draft]);
  useEffect(() => {
    if (!history.revision) return;
    setStatus("Saving…");
    const save = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current().dataset)); setStatus("Saved in this browser."); }
      catch { setStatus("Not saved — export a backup."); setError("Browser storage is unavailable or full. Export JSON to keep your work."); }
    };
    const timer = setTimeout(save, 250); window.addEventListener("pagehide", save);
    return () => { clearTimeout(timer); window.removeEventListener("pagehide", save); };
  }, [history.revision]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing && mode === "author") { e.preventDefault(); undo(e.shiftKey); }
      if (e.key === "Escape" && mode === "author" && (menu || connection || draft || quickEdge)) { e.preventDefault(); e.stopPropagation(); close(); focusCanvas(); }
      // Escape closes the ring and keeps the selection in both modes; pressing it again clears the selection
      else if (e.key === "Escape" && graph.menuVisible && !graph.tracing && !typing) { e.preventDefault(); e.stopPropagation(); graph.finishMarking(null, graph.activeRoute, undefined); focusCanvas(); }
    };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  });

  const attach = (cy: Core) => {
    ready.current = false;
    graph.attach(cy); keepConstantSize(cy); applyFilter(cy);
    const el = cy.container()!; el.setAttribute("aria-label", "Causal graph");
    let frame = 0;
    const repaint = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; redraw(n => n + 1); }); };
    cy.on("viewport", () => { if (ready.current) viewport.current = { zoom: cy.zoom(), pan: { ...cy.pan() } }; repaint(); });
    cy.on("position", repaint);
    cy.on("destroy", () => cancelAnimationFrame(frame));
    cy.on("grab", "node", () => { if (latest.current.mode === "author") dragBefore.current = current.current(); });
    cy.on("dragfree", "node", () => {
      if (latest.current.mode !== "author") return;
      const before = dragBefore.current; dragBefore.current = null;
      positions.current = positionsOf(cy);
      if (before) dispatch({ type: "commit", before, after: { ...before, dataset: withPositions(before.dataset, before.version, positions.current) } });
    });
    cy.on("cxttap", "node", (e: EventObject) => {
      if (latest.current.mode === "author") handlers.current.openMenu(e.target.id());
      else graph.beginMarking(e.target.id());
    });
    // Holding a node is left to the traversal fan in both modes: choosing where to look is the same
    // act whether or not the graph can be edited. Editing a node is a right-click or a double-click
    cy.on("dbltap", "node", (e: EventObject) => { if (latest.current.mode === "author" && !latest.current.connection) handlers.current.openMenu(e.target.id()); });
    cy.on("tap", (e: EventObject) => {
      if (latest.current.mode !== "author") return;
      const pending = latest.current.connection;
      if (pending) {
        if (e.target === cy) setDraft({ label: "", position: { ...e.position }, connection: pending });
        else if (e.target.isNode()) handlers.current.createLink(pending, e.target.id());
      } else { setMenu(null); setQuickEdge(null); }
    });
    // Double-click is for text, on a node or on empty canvas. Right-click only ever opens a ring, so on empty canvas it adds nothing
    cy.on("dbltap", (e: EventObject) => {
      if (latest.current.mode === "author" && e.target === cy && !latest.current.connection) { setMenu(null); setDraft({ label: "", position: { ...e.position } }); }
    });
    cy.on("cxttap", (e: EventObject) => { if (latest.current.mode === "author" && e.target === cy) setMenu(null); });
    cy.on("mousemove", (e: EventObject) => { if (latest.current.connection) setPointer({ ...e.renderedPosition }); });
  };
  const layoutComplete = (points: Positions) => {
    const cy = graph.cy.current; if (!cy) return;
    if (viewport.current) cy.viewport(viewport.current);
    positions.current = points; ready.current = true;
    viewport.current = { zoom: cy.zoom(), pan: { ...cy.pan() } };
    graph.clear();
    const selection = history.present.selection;
    selection.nodes.filter(id => snapshot.nodes.some(n => n.id === id)).forEach(id => graph.toggle(id));
    if (selection.link && snapshot.edges.some(e => e.id === selection.link)) graph.toggleLink(selection.link);
    redraw(n => n + 1);
  };
  const switchMode = (next: "author" | "explore") => {
    if (mode === next) return;
    close(); graph.finishMarking(null, graph.activeRoute, undefined);
    // Explore may rearrange nodes temporarily. Return to the authored positions without moving the camera.
    if (next === "author" && graph.cy.current) graph.cy.current.nodes().positions(n => positions.current[n.id()] ?? n.position());
    setMode(next);
  };
  const imported = async (file?: File) => {
    if (!file) return;
    try {
      const data = parseDataset(JSON.parse(await file.text()));
      if (snapshot.nodes.length && !confirm("Replace this graph with the imported dataset? You can undo this.")) return;
      close(); commit(data, unselected(), materialize(), data.snapshots[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not import JSON."); }
  };
  const quick = snapshot.edges.find(e => e.id === (quickEdge ?? edge?.id));
  const menuNode = snapshot.nodes.find(n => n.id === menu);
  const menuHub = menuNode ? hubOf(menuNode.id) : null;
  const draftPosition = draft ? place(screen(draft.position), 120, 64) : null;
  // The provisional link runs edge to edge, so it never strikes through a label. While the new
  // variable is being named it stays attached, from the origin to the name being typed
  const clip = (c: Point, toward: Point, w: number, h: number): Point => {
    const [dx, dy] = [toward.x - c.x, toward.y - c.y];
    const t = Math.min(1, (w / 2 + 3) / Math.abs(dx || 1e-6), (h / 2 + 3) / Math.abs(dy || 1e-6));
    return { x: c.x + dx * t, y: c.y + dy * t };
  };
  const preview = (() => {
    const n = connection && graph.cy.current?.getElementById(connection.origin);
    const aim = draft ? (draft.connection ? draftPosition : null) : pointer;
    if (!connection || !n?.length || !aim) return null;
    const hub = n.renderedPosition();
    const near = clip(hub, aim, n.renderedOuterWidth(), n.renderedOuterHeight());
    const far = draft ? clip(aim, hub, ghost.current?.offsetWidth ?? 90, ghost.current?.offsetHeight ?? 28) : aim;
    return connection.direction === "effect" ? { from: near, to: far } : { from: far, to: near };
  })();
  const polarityButtons = (id: string) => <div className="polarity-buttons" role="group" aria-label="Link polarity">{[[undefined, "Unknown"], ["positive", "+ Positive"], ["negative", "− Negative"]].map(([value, label]) => <button key={label} aria-pressed={snapshot.edges.find(e => e.id === id)?.polarity === value} onClick={() => setPolarity(id, value as CausalEdge["polarity"])}>{label}</button>)}</div>;

  return <div className="studio">
    <header className="studio-header"><a className="studio-brand" href={docs}><img src="/mark.svg" width="32" height="32" alt="" /><img src="/wordmark.svg" width="138" height="30" alt="cytocausal" /><span>Studio</span></a><div className="studio-tools">
      <button onClick={() => { if (confirm("Start a new graph? You can undo this.")) { close(); commit(emptyDataset(), unselected(), materialize(), "draft"); } }}>New graph</button>
      <label className="file-button">Import JSON<input type="file" accept=".json,application/json" onChange={e => { void imported(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <button onClick={() => download(materialize().dataset)}>Export JSON</button><a href={docs}>Docs ↗</a>
    </div></header>
    <div className="studio-bar"><label className="graph-title">Graph name<input aria-label="Graph name" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => { if (title.trim()) commit({ ...materialize().dataset, id: title.trim() }); else setTitle(dataset.id); }} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
      <span role="status" className="save-status">{status}</span><button disabled={mode !== "author" || !history.past.length} onClick={() => undo()}>Undo</button><button disabled={mode !== "author" || !history.future.length} onClick={() => undo(true)}>Redo</button>
      <div className="mode-switch" role="group" aria-label="Node style"><button aria-pressed={nodeStyle === "text"} title="The name is the node, for a diagram read whole" onClick={() => onNodeStyle("text")}><svg viewBox="0 0 22 12" width="22" height="12" aria-hidden="true"><rect x="1" y="1" width="20" height="10" rx="3"/><path d="M6 6h10"/></svg>Text in node</button><button aria-pressed={nodeStyle === "dot"} title="The name sits beside a dot, for a dense network" onClick={() => onNodeStyle("dot")}><svg viewBox="0 0 22 12" width="22" height="12" aria-hidden="true"><path d="M3 2.5h16"/><circle cx="11" cy="8.5" r="3"/></svg>Text by dot</button></div>
      <div className="mode-switch" role="group" aria-label="Workspace mode"><button aria-pressed={mode === "author"} onClick={() => switchMode("author")}>Author</button><button aria-pressed={mode === "explore"} onClick={() => switchMode("explore")}>Explore</button></div>
    </div>
    {error && <div role="alert" className="studio-error">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    <main className="studio-main"><section ref={canvas} className={`studio-canvas ${connection ? "is-connecting" : ""}`} aria-label="Drawing canvas"
      onContextMenu={e => { if ((e.target as HTMLElement).closest("canvas")) e.preventDefault(); }}
      onKeyDownCapture={e => { if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && node) { e.preventDefault(); e.stopPropagation(); if (mode === "author") openMenu(node.id); else graph.beginMarking(node.id); } }}>
      <GraphView dataset={dataset} snapshotId={version} stylesheet={stylesheet} layout={snapshot.nodes.every(n => n.position) ? savedLayout : autoLayout} onReady={attach} onLayoutComplete={layoutComplete} />
      <RadialMenu sectors depthRings={false} aroundLabel={nodeStyle === "dot"} />
      {/* What the selected node answers to, said once at the foot of the canvas instead of a button on every node */}
      {node && graph.selected.length === 1 && !menu && !graph.menuVisible && !draft && !connection && !edge && !quickEdge && <p className="gesture-hint" role="status"><span><kbd>Hold</kbd> to explore</span><span>{mode === "author" ? <><kbd>Double-click</kbd> to add</> : <><kbd>Right-click</kbd> for links</>}</span></p>}
      {mode === "author" && <>
        {!snapshot.nodes.length && !draft && <div className="empty-canvas"><img src="/mark.svg" width="72" height="72" alt=""/><h1>Start with a cause.</h1><p>Double-click the canvas to add your first variable.</p><button className="primary" onClick={() => setDraft({ label: "", position: centerPosition() })}>Add variable</button></div>}
        {menuNode && menuHub && <AuthorMenu key={menuNode.id} {...menuHub} label={menuNode.label} onConnect={(d, start) => start ? dragOut(menuNode.id, d, start) : beginConnection(menuNode.id, d)} onRename={() => rename(menuNode.id)} onDelete={() => removeNode(menuNode.id)} onClose={() => { setMenu(null); focusCanvas(); }} />}
        {connection && <div className="connection-hint" role="status"><strong>{connection.direction === "effect" ? "Add effect" : "Add cause"}</strong><span>Click a variable to link it, or empty space to name a new one.</span><button onClick={close}>Cancel</button></div>}
        {preview && <svg className="connection-preview" aria-hidden="true"><defs><marker id="draft-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8Z"/></marker></defs><line x1={preview.from.x} y1={preview.from.y} x2={preview.to.x} y2={preview.to.y} markerEnd="url(#draft-arrow)" /></svg>}
        {draft && draftPosition && <form className={`ghost-node is-${nodeStyle} ${draft.node ? "is-rename" : "is-new"}`} style={{ left: draftPosition.x, top: draftPosition.y }} onSubmit={e => { e.preventDefault(); submitDraft(); }}>
          <span ref={nodeStyle === "text" ? ghost : undefined} className="ghost-pill" data-value={draft.label || "Name"}><input ref={input} aria-label="Variable name" value={draft.label} placeholder="Name" autoComplete="off" spellCheck={false}
            onChange={e => setDraft({ ...draft, label: e.target.value })}
            // Still being the active field means only the window lost focus, which commits nothing.
            // Clicking away keeps what was typed. An empty name is dropped, and a link in progress stays to be placed again
            onBlur={e => { if (!latest.current.draft || document.activeElement === e.currentTarget) return; if (draft.label.trim()) submitDraft(); else if (draft.connection) setDraft(null); else close(); }} /></span>
          {nodeStyle === "dot" && <span ref={ghost} className="ghost-dot" />}
          <small>{draft.node ? "Enter to rename" : draft.connection ? `Enter to add ${draft.connection.direction}` : "Enter to create"} · Esc to cancel</small>
        </form>}
        {quick && !draft && !connection && <div className="quick-polarity"><span>{snapshot.nodes.find(n => n.id === quick.source)?.label} → {snapshot.nodes.find(n => n.id === quick.target)?.label}</span>{polarityButtons(quick.id)}<button aria-label="Close polarity editor" onClick={() => { setQuickEdge(null); graph.clear(); }}>×</button></div>}
      </>}
      <div className="canvas-controls"><span>{snapshot.nodes.length} nodes · {snapshot.edges.length} links</span>{mode === "author" && <button onClick={() => { close(); setDraft({ label: "", position: centerPosition() }); }}>Add variable</button>}<button disabled={!snapshot.nodes.length} onClick={() => {
        const cy = graph.cy.current; if (!cy) return; const before = materialize();
        relayout(cy, autoLayout, { onSettled: () => { if (cy.destroyed() || latest.current.mode !== "author") return; positions.current = positionsOf(cy); commit(withPositions(before.dataset, version, positions.current), selected(), before); } });
      }}>Arrange</button><ZoomControls graph={graph} /></div>
    </section><aside className="studio-inspector">
      {dataset.snapshots.length > 1 && <label>Snapshot<select aria-label="Snapshot" value={version} onChange={e => { close(); dispatch({ type: "navigate", document: { ...materialize(), version: e.target.value, selection: unselected() } }); }}>{dataset.snapshots.map(s => <option key={s.id}>{s.id}</option>)}</select></label>}
      {mode === "explore" ? <><h2>Explore your graph</h2><p className="hint">Hold a node, or right-click it, to follow its connections. Exploration does not edit your graph.</p><DepthControl /><button onClick={exportImage}>Export PNG</button><NodeSearch /><ContributorFilter /><CyclePanel /><SelectionPanel /><VersionDiff /></> : <>
        <h2>{node ? node.label : edge ? "Relationship" : "Create your graph"}</h2>
        {node ? <><button onClick={() => rename(node.id)}>Rename</button><button onClick={() => beginConnection(node.id, "cause")}>Add cause</button><button onClick={() => beginConnection(node.id, "effect")}>Add effect</button><p className="hint">Right-click or double-click for the edit ring. Hold to follow its links.</p><button className="danger" onClick={() => removeNode(node.id)}>Delete node and its links</button></> : edge ? <><p>{snapshot.nodes.find(n => n.id === edge.source)?.label} → {snapshot.nodes.find(n => n.id === edge.target)?.label}</p>{polarityButtons(edge.id)}<button className="danger" onClick={() => { update(s => ({ ...s, edges: s.edges.filter(e => e.id !== edge.id) }), unselected()); close(); }}>Delete link</button></> : <><p>Double-click empty canvas and type a name. Right-click or double-click a variable, then drag from <strong>Add cause</strong> or <strong>Add effect</strong> to where the new one belongs.</p><p className="hint">Let go on a variable to link it, or on empty space to name a new one. Enter creates; Escape cancels; ⌘/Ctrl Z undoes.</p></>}
        <p className="hint">Positive: changes in the same direction. Negative: opposite direction. Leave Unknown when unsure.</p>
        <details><summary>Nodes and links</summary><ul className="element-list">{snapshot.nodes.map(n => <li key={n.id}><button onClick={() => { close(); selectNode(n.id); }}>{n.label}</button></li>)}{snapshot.edges.map(e => <li key={e.id}><button onClick={() => { close(); graph.clear(); graph.toggleLink(e.id); }}>{snapshot.nodes.find(n => n.id === e.source)?.label} → {snapshot.nodes.find(n => n.id === e.target)?.label}</button></li>)}</ul></details>
        <p className="hint privacy">Saved in this browser. Export JSON for backup or to move to another device.</p>
      </>}
      <div className="hint interaction-key">
        <svg viewBox="-28 -28 56 56" width="44" height="44" aria-hidden="true"><path className="key-sector" d="M-15.6 -15.6A22 22 0 0 1 15.6 -15.6L9.2 -9.2A13 13 0 0 0 -9.2 -9.2Z M17 -14A22 22 0 0 1 17 14L10 8.3A13 13 0 0 0 10 -8.3Z" /><circle className="key-node" r="8" /></svg>
        <p><strong>Yellow is where you are. Sectors are where you can go.</strong> {mode === "author" ? "Here they add a cause, an effect, a name or a deletion." : "Here they point at the links that already exist."}</p>
      </div>
      <p className="hint">Click to select · Hold to follow links · {mode === "author" ? "Right-click or double-click to edit" : "Right-click for the links"} · Point to preview, click to commit · Escape to dismiss</p>
      <p className="hint">Arrows run from cause to effect. Dashes mean negative. Blue is being added, red removed.</p>
    </aside></main>
  </div>;
}
