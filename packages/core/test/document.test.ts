import { test } from "node:test";
import assert from "node:assert/strict";
import { createCausalDocument, type CausalDataset, type EditDraft } from "../src/index.ts";
const dataset = (): CausalDataset => ({ id: "test", snapshots: [
  { id: "draft", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ id: "ab", source: "a", target: "b" }] },
  { id: "review", nodes: [{ id: "renamed", label: "A reviewed" }], edges: [] },
], correspondences: [{ from: "draft", to: "review", nodes: { a: "renamed" } }] });
const make = () => { let id = 0; return createCausalDocument(dataset(), { idFactory: kind => `${kind}:${++id}` }); };

test("batch creates one undo entry, notifies once and restores generated IDs on redo", () => {
  const doc = make(); let notifications = 0; doc.subscribe(() => notifications++);
  const edit = doc.edit("draft");
  const result = edit.batch("growth", draft => {
    const n = draft.addNode({ label: "Growth", metadata: { score: 1 } });
    draft.addEdge({ source: "a", target: n.id, polarity: "positive" });
  });
  assert.equal(result.ok, true); assert.equal(notifications, 1);
  const after = doc.getState().dataset;
  assert.equal(doc.getState().revision, 1);
  edit.undo(); assert.deepEqual(doc.getState().dataset, dataset());
  edit.redo(); assert.deepEqual(doc.getState().dataset, after);
  assert.equal(doc.getState().revision, 3);
});

test("invalid endpoint and caught errors roll back data, history and notifications", () => {
  const doc = make(), before = doc.getState(); let notifications = 0; doc.subscribe(() => notifications++);
  const result = doc.edit("draft").batch("invalid", draft => {
    draft.addNode({ id: "new", label: "New" });
    draft.addEdge({ source: "new", target: "absent" });
  });
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.error.code, "DanglingEdge");
  assert.equal(doc.getState(), before); assert.equal(notifications, 0);
  const caught = doc.edit("draft").batch("caught", draft => {
    draft.addNode({ id: "new", label: "New" });
    try { draft.addNode({ id: "a", label: "Duplicate" }); } catch {}
  });
  assert.equal(caught.ok, false); assert.equal(doc.getState(), before);
});

test("draft escape, async callbacks and reentrant document commands cannot commit", async () => {
  const doc = make(), before = doc.getState(); let escaped: EditDraft | undefined;
  doc.edit("draft").batch("capture", draft => { escaped = draft; });
  assert.throws(() => escaped!.addNode({ label: "Expired" }), /expired/);
  const asyncResult = doc.edit("draft").batch("async", async draft => { draft.addNode({ label: "Before await" }); await Promise.resolve(); draft.addNode({ label: "After await" }); });
  assert.equal(asyncResult.ok, false); await Promise.resolve();
  assert.equal(doc.getState(), before);
  const nested = doc.edit("draft").batch("nested", draft => { draft.addNode({ label: "New" }); doc.undo(); });
  assert.equal(nested.ok, false); assert.equal(doc.getState(), before);
});

test("deleting a node cleans its incident edges and correspondences, without touching other snapshots", () => {
  const doc = make(); assert.equal(doc.edit("draft").remove({ nodes: ["a"] }).ok, true);
  const after = doc.getState().dataset;
  assert.deepEqual(after.snapshots[0].nodes.map(n => n.id), ["b"]);
  assert.equal(after.snapshots[0].edges.length, 0);
  assert.deepEqual(after.correspondences![0].nodes, {});
  assert.deepEqual(after.snapshots[1], dataset().snapshots[1]);
  doc.undo(); assert.deepEqual(doc.getState().dataset, dataset());
});

test("stale or cross-version targets fail, while same-view targets remove atomically", () => {
  const doc = make(), edit = doc.edit("draft");
  const selection = { snapshotId: "draft", revision: 0, nodes: ["a"] };
  edit.addNode({ label: "New" });
  assert.equal(edit.remove(selection).ok, false);
  assert.equal(edit.remove({ ...selection, snapshotId: "review", revision: 1 }).ok, false);
  assert.equal(edit.remove({ ...selection, revision: 1 }).ok, true);
});

test("invalid patch, ID changes, duplicate IDs across kinds and positions never partially apply", () => {
  const doc = make(), before = doc.getState(), edit = doc.edit("draft");
  assert.equal(edit.addNode({ id: "ab", label: "Edge ID" }).ok, false);
  assert.equal(edit.updateNode("a", { id: "other" } as never).ok, false);
  assert.equal(edit.updateEdge("ab", { target: "missing" }).ok, false);
  assert.equal(edit.updateEdge("ab", { polarity: "bad" } as never).ok, false);
  assert.equal(edit.setPositions({ a: { x: 2, y: 3 }, b: { x: NaN, y: 0 } }).ok, false);
  assert.equal(edit.updateNode("missing", { label: "New" }).ok, false);
  assert.equal(doc.getState(), before);
});

test("no-op preserves redo, new edits branch, loads reset history with monotonic revisions", () => {
  const doc = make(), edit = doc.edit("draft");
  edit.updateNode("a", { label: "Changed" }); doc.undo();
  const before = doc.getState(); edit.updateNode("a", { label: "A" });
  assert.equal(doc.getState(), before); assert.equal(doc.getState().canRedo, true);
  edit.updateNode("b", { label: "Branched" }); assert.equal(doc.getState().canRedo, false);
  const revision = doc.getState().revision;
  doc.load(dataset()); assert.equal(doc.getState().canUndo, false); assert.equal(doc.getState().revision, revision + 1);
});

test("input, return values and observers cannot mutate document data; subscriptions unsubscribe", () => {
  const input = dataset(), doc = createCausalDocument(input); let notices = 0;
  const stop = doc.subscribe(() => notices++); input.snapshots[0].nodes[0].label = "External";
  assert.equal(doc.getState().dataset.snapshots[0].nodes[0].label, "A");
  assert.throws(() => { doc.getState().dataset.snapshots[0].nodes[0].label = "Mutated"; });
  const patch = { metadata: { category: "weather" } }; doc.edit("draft").updateNode("a", patch); patch.metadata.category = "mutated";
  assert.equal(doc.getState().dataset.snapshots[0].nodes[0].metadata?.category, "weather");
  stop(); doc.edit("draft").updateNode("b", { label: "Changed" }); assert.equal(notices, 1);
});

test("editor session checkpoints travel with history without becoming dataset fields", () => {
  const doc = make(), changed = dataset(); changed.id = "New name";
  const before = { version: "draft", selection: { nodes: ["a"], link: null } };
  const after = { version: "review", selection: { nodes: [], link: null } };
  doc.replaceDataset(changed, { checkpoint: { before, after } });
  const undo = doc.undo(), redo = doc.redo();
  assert.ok(undo.ok && redo.ok); assert.deepEqual(undo.value.checkpoint, before); assert.deepEqual(redo.value.checkpoint, after);
  assert.equal("checkpoint" in doc.getState().dataset, false);
});

test("non-JSON metadata and invalid checkpoints return errors without corrupting history", () => {
  const doc = make(), state = doc.getState();
  assert.equal(doc.edit("draft").updateNode("a", { metadata: { value: Infinity } }).ok, false);
  assert.equal(doc.edit("draft").updateNode("a", { metadata: { value: 1n } }).ok, false);
  const changed = dataset(); changed.id = "Changed";
  assert.equal(doc.replaceDataset(changed, { checkpoint: { before: () => {}, after: {} } }).ok, false);
  assert.equal(doc.getState(), state);
});
