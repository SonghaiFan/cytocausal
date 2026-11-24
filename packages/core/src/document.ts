import { parseDataset } from "./editing.ts";
import type { CausalDataset, CausalEdge, CausalNode } from "./types.ts";

export type CausalErrorCode = "InvalidInput" | "UnknownElement" | "DuplicateId" | "DanglingEdge" | "SnapshotMismatch" | "StaleResult" | "SelectionLimit" | "ViewUnavailable" | "TransactionFailed";
export interface CausalError { code: CausalErrorCode; message: string; ids?: readonly string[] }
export type CausalResult<T> = { ok: true; value: T } | { ok: false; error: CausalError };
export interface ElementIds { nodes?: readonly string[]; edges?: readonly string[] }
export interface ElementSet extends ElementIds { snapshotId: string; revision: number }
export interface EditReceipt<T = void> { changed: boolean; revision: number; value: T; checkpoint?: unknown }
export type EditResult<T = void> = CausalResult<EditReceipt<T>>;
export interface EditOptions { expectedRevision?: number; checkpoint?: { before: unknown; after: unknown } }
export type NodeInput = Omit<CausalNode, "id"> & { id?: string };
export type EdgeInput = Omit<CausalEdge, "id"> & { id?: string };
export type NodePatch = Partial<Omit<CausalNode, "id">>;
export type EdgePatch = Partial<Omit<CausalEdge, "id">>;
export interface EditDraft {
  addNode(input: NodeInput): { id: string };
  addEdge(input: EdgeInput): { id: string };
  updateNode(id: string, patch: NodePatch): void;
  updateEdge(id: string, patch: EdgePatch): void;
  remove(target: ElementIds | ElementSet): void;
  setPositions(positions: Record<string, { x: number; y: number }>): void;
}
export interface CausalEditing {
  addNode(input: NodeInput): EditResult<{ id: string }>;
  addEdge(input: EdgeInput): EditResult<{ id: string }>;
  updateNode(id: string, patch: NodePatch): EditResult;
  updateEdge(id: string, patch: EdgePatch): EditResult;
  remove(target: ElementIds | ElementSet): EditResult;
  setPositions(positions: Record<string, { x: number; y: number }>): EditResult;
  batch(label: string, run: (draft: EditDraft) => void): EditResult;
  replaceDataset(dataset: CausalDataset): EditResult;
  undo(): EditResult;
  redo(): EditResult;
}
export interface CausalDocumentState {
  readonly dataset: CausalDataset;
  readonly revision: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly change: "initial" | "edit" | "undo" | "redo" | "load";
}
export interface CausalDocument {
  getState(): CausalDocumentState;
  subscribe(listener: () => void): () => void;
  edit(snapshotId: string): CausalEditing;
  replaceDataset(dataset: CausalDataset, options?: EditOptions): EditResult;
  load(dataset: CausalDataset): EditResult;
  undo(): EditResult;
  redo(): EditResult;
}
export const causalFailure = (code: CausalErrorCode, message: string, ids?: readonly string[]): { ok: false; error: CausalError } => ({ ok: false, error: { code, message, ...(ids ? { ids } : {}) } });
class EditFailure extends Error {
  readonly issue: CausalError;
  constructor(issue: CausalError) { super(issue.message); this.issue = issue; }
}
const fail = (code: CausalErrorCode, message: string, ids?: readonly string[]): never => { throw new EditFailure({ code, message, ids }); };
function freeze<T>(value: T, ancestors = new Set<object>()): T {
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function" || typeof value === "number" && !Number.isFinite(value)) throw new Error("Document values must be JSON-compatible plain data.");
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    if (ancestors.has(value)) throw new Error("Document values cannot contain cycles.");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error("Document values must be plain data.");
    ancestors.add(value); Object.values(value).forEach(item => freeze(item, ancestors)); ancestors.delete(value); Object.freeze(value);
  }
  return value;
}
const same = (a: CausalDataset, b: CausalDataset) => JSON.stringify(a) === JSON.stringify(b);

/** An immutable document with atomic edits. Sessions, renderers and persistence stay outside it. */
export function createCausalDocument(initialDataset: CausalDataset, options: { idFactory?: (kind: "node" | "edge") => string; historyLimit?: number } = {}): CausalDocument {
  const limit = options.historyLimit ?? 50;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("historyLimit must be a positive integer.");
  const idFactory = options.idFactory ?? (kind => `${kind}:${crypto.randomUUID()}`);
  let state: CausalDocumentState = freeze({ dataset: parseDataset(initialDataset), revision: 0, canUndo: false, canRedo: false, change: "initial" });
  type Entry = { before: CausalDataset; after: CausalDataset; checkpoint?: EditOptions["checkpoint"] };
  let past: Entry[] = [], future: Entry[] = [];
  const listeners = new Set<() => void>();
  let editing = false;
  let blockedIssue: CausalError | null = null;
  const blocked = () => { blockedIssue = { code: "TransactionFailed", message: "Nested document commands are not supported." }; return { ok: false as const, error: blockedIssue }; };
  const receipt = <T>(changed: boolean, value: T, checkpoint?: unknown): EditResult<T> => ({ ok: true, value: { changed, revision: state.revision, value, ...(checkpoint === undefined ? {} : { checkpoint: structuredClone(checkpoint) }) } });
  const publish = (dataset: CausalDataset, change: CausalDocumentState["change"]) => {
    state = freeze({ dataset, revision: state.revision + 1, canUndo: past.length > 0, canRedo: future.length > 0, change });
    // Observers see a fully committed document. Their failures cannot roll back the commit.
    for (const listener of [...listeners]) { try { listener(); } catch (error) { queueMicrotask(() => { throw error; }); } }
  };
  const checked = (input: CausalDataset): CausalResult<CausalDataset> => {
    try { return { ok: true, value: freeze(parseDataset(input)) }; }
    catch (error) { return causalFailure("InvalidInput", error instanceof Error ? error.message : String(error)); }
  };
  const commit = (next: CausalDataset, context?: EditOptions["checkpoint"]): EditResult => {
    const parsed = checked(next); if (!parsed.ok) return parsed;
    if (same(state.dataset, parsed.value)) return receipt(false, undefined);
    let checkpoint: EditOptions["checkpoint"];
    try { checkpoint = context === undefined ? undefined : structuredClone(context); }
    catch { return causalFailure("InvalidInput", "History checkpoints must be cloneable data."); }
    const entry = { before: state.dataset, after: parsed.value, checkpoint };
    past = [...past, entry].slice(-limit); future = [];
    publish(entry.after, "edit"); return receipt(true, undefined);
  };
  const replaceDataset: CausalDocument["replaceDataset"] = (dataset, editOptions = {}) => {
    if (editing) return blocked();
    if (editOptions.expectedRevision !== undefined && editOptions.expectedRevision !== state.revision) return causalFailure("StaleResult", "The document has changed.");
    return commit(dataset, editOptions.checkpoint);
  };
  const travel = (redo: boolean): EditResult => {
    if (editing) return blocked();
    const entry = (redo ? future : past).at(-1); if (!entry) return receipt(false, undefined);
    if (redo) { future = future.slice(0, -1); past = [...past, entry]; }
    else { past = past.slice(0, -1); future = [...future, entry]; }
    publish(redo ? entry.after : entry.before, redo ? "redo" : "undo");
    return receipt(true, undefined, redo ? entry.checkpoint?.after : entry.checkpoint?.before);
  };
  const document: CausalDocument = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    replaceDataset,
    load(dataset) {
      if (editing) return blocked();
      const parsed = checked(dataset); if (!parsed.ok) return parsed;
      past = []; future = []; publish(freeze(parsed.value), "load"); return receipt(true, undefined);
    },
    undo: () => travel(false), redo: () => travel(true),
    edit(snapshotId) {
      function transaction<T>(run: (draft: EditDraft) => T): EditResult<T> {
        if (editing) return blocked();
        let data = structuredClone(state.dataset);
        const snapshot = data.snapshots.find(s => s.id === snapshotId);
        if (!snapshot) return causalFailure("SnapshotMismatch", `Unknown snapshot: ${snapshotId}`);
        let open = true;
        const assertOpen = () => { if (!open) fail("TransactionFailed", "The transaction draft has expired."); };
        const node = (id: string) => { assertOpen(); return snapshot.nodes.find(n => n.id === id) ?? fail("UnknownElement", `Unknown node: ${id}`, [id]); };
        const edge = (id: string) => { assertOpen(); return snapshot.edges.find(e => e.id === id) ?? fail("UnknownElement", `Unknown edge: ${id}`, [id]); };
        const allocate = (kind: "node" | "edge", supplied?: string) => {
          assertOpen(); const id = supplied ?? idFactory(kind);
          if (snapshot.nodes.some(n => n.id === id) || snapshot.edges.some(e => e.id === id)) fail("DuplicateId", `Duplicate element id: ${id}`, [id]);
          return id;
        };
        const draft: EditDraft = {
          addNode(input) { const id = allocate("node", input.id); snapshot.nodes.push(structuredClone({ ...input, id })); return { id }; },
          addEdge(input) { const id = allocate("edge", input.id); snapshot.edges.push(structuredClone({ ...input, id })); return { id }; },
          updateNode(id, patch) { if ("id" in patch) fail("InvalidInput", "Node IDs cannot be changed."); Object.assign(node(id), structuredClone(patch)); },
          updateEdge(id, patch) { if ("id" in patch) fail("InvalidInput", "Edge IDs cannot be changed."); Object.assign(edge(id), structuredClone(patch)); },
          remove(target) {
            assertOpen();
            if ("snapshotId" in target && target.snapshotId !== snapshotId) fail("SnapshotMismatch", "The selection belongs to another snapshot.");
            if ("revision" in target && target.revision !== state.revision) fail("StaleResult", "The selection is stale.");
            target.nodes?.forEach(node); target.edges?.forEach(edge);
            const removed = new Set(target.nodes ?? []), links = new Set(target.edges ?? []);
            snapshot.nodes = snapshot.nodes.filter(n => !removed.has(n.id));
            snapshot.edges = snapshot.edges.filter(e => !links.has(e.id) && !removed.has(e.source) && !removed.has(e.target));
            data.correspondences = data.correspondences?.map(map => ({ ...map, nodes: Object.fromEntries(Object.entries(map.nodes).filter(([from, to]) => !(map.from === snapshotId && removed.has(from)) && !(map.to === snapshotId && removed.has(to)))) }));
          },
          setPositions(positions) { Object.entries(positions).forEach(([id, position]) => { node(id).position = structuredClone(position); }); },
        };
        editing = true; blockedIssue = null;
        const guarded = new Proxy(draft, { get(target, key) {
          const method = Reflect.get(target, key);
          if (typeof method !== "function") return method;
          return (...args: unknown[]) => {
            try { return method(...args); }
            catch (error) {
              blockedIssue = error instanceof EditFailure ? error.issue : { code: "TransactionFailed", message: String(error) };
              throw error;
            }
          };
        } });
        try {
          const value = run(guarded);
          if (blockedIssue) return { ok: false, error: blockedIssue };
          if (value && typeof (value as { then?: unknown }).then === "function") {
            // Consume a rejected async callback without allowing it to commit or use an expired draft.
            void Promise.resolve(value).catch(() => {});
            return causalFailure("TransactionFailed", "Draft callbacks must be synchronous.");
          }
          for (const e of snapshot.edges) if (!snapshot.nodes.some(n => n.id === e.source) || !snapshot.nodes.some(n => n.id === e.target)) return causalFailure("DanglingEdge", `Edge ${e.id} has a missing endpoint.`, [e.id]);
          open = false; editing = false;
          const result = commit(data); if (!result.ok) return result;
          return receipt(result.value.changed, value);
        } catch (error) {
          return error instanceof EditFailure ? { ok: false, error: error.issue } : causalFailure("TransactionFailed", error instanceof Error ? error.message : String(error));
        } finally { open = false; editing = false; blockedIssue = null; }
      }
      return {
        addNode: input => transaction(d => d.addNode(input)), addEdge: input => transaction(d => d.addEdge(input)),
        updateNode: (id, patch) => transaction(d => d.updateNode(id, patch)), updateEdge: (id, patch) => transaction(d => d.updateEdge(id, patch)),
        remove: target => transaction(d => d.remove(target)), setPositions: positions => transaction(d => d.setPositions(positions)),
        batch: (_label, run) => transaction(run), replaceDataset, undo: document.undo, redo: document.redo,
      };
    },
  };
  return document;
}
