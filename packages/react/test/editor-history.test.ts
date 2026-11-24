import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEditorAction, unselected, type DocumentState } from "../src/editor-history.ts";
import { createCausalDocument, createEmptyDataset } from "@cytocausal/core";
const initial = (): DocumentState => ({ dataset: createEmptyDataset(), version: "draft", selection: unselected() });
test("editor and public commands use one history, with stable IDs on redo", () => {
  const before = initial(), doc = createCausalDocument(before.dataset), after = structuredClone(before);
  after.dataset.snapshots[0].nodes = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
  after.dataset.snapshots[0].edges = [{ id: "ab", source: "a", target: "b" }]; after.selection.nodes = ["b"];
  applyEditorAction(doc, "editor", { type: "commit", before, after });
  const undo = applyEditorAction(doc, "editor", { type: "undo", current: after });
  assert.deepEqual(doc.getState().dataset, before.dataset); assert.deepEqual(undo.session, { version: "draft", selection: unselected() });
  const redo = applyEditorAction(doc, "editor", { type: "redo", current: before });
  assert.deepEqual(doc.getState().dataset, after.dataset); assert.deepEqual(redo.session?.selection.nodes, ["b"]);
  doc.edit("draft").updateNode("b", { label: "Public edit" });
  applyEditorAction(doc, "editor", { type: "undo", current: after });
  assert.equal(doc.getState().dataset.snapshots[0].nodes[1].label, "B");
});
test("navigation does not commit positions or mutate document history", () => {
  const before = initial(), doc = createCausalDocument(before.dataset), state = doc.getState();
  const navigation = applyEditorAction(doc, "editor", { type: "navigate", document: { ...before, version: "review" } });
  assert.equal(doc.getState(), state); assert.equal(navigation.session?.version, "review");
});
test("undo from another editor does not adopt the first editor's selection", () => {
  const before = initial(), doc = createCausalDocument(before.dataset), after = { ...before, dataset: { ...before.dataset, id: "Changed" } };
  applyEditorAction(doc, "one", { type: "commit", before, after });
  const result = applyEditorAction(doc, "two", { type: "undo", current: after });
  assert.equal(result.session, undefined); assert.equal(doc.getState().dataset.id, before.dataset.id);
});
