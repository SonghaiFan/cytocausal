import { test } from "node:test";
import assert from "node:assert/strict";
import { historyReducer, unselected, type History, type DocumentState } from "../src/history.ts";
import { emptyDataset } from "../src/model.ts";
const initial = (): DocumentState => ({ dataset: emptyDataset(), version: "draft", selection: unselected() });
test("one relationship creation undoes its endpoint too and redo preserves the IDs", () => {
  const before = initial(); const after = structuredClone(before);
  after.dataset.snapshots[0].nodes = [{ id: "cause", label: "Cause" }, { id: "effect", label: "Effect" }];
  after.dataset.snapshots[0].edges = [{ id: "link", source: "cause", target: "effect" }];
  after.selection.nodes = ["effect"];
  let h: History = { present: before, past: [], future: [], revision: 0 };
  h = historyReducer(h, { type: "commit", before, after });
  assert.equal(h.past.length, 1);
  h = historyReducer(h, { type: "undo", current: after }); assert.deepEqual(h.present, before);
  h = historyReducer(h, { type: "redo", current: before }); assert.deepEqual(h.present, after);
});
test("no-op edits preserve redo and a new edit starts a new branch", () => {
  const before = initial(); const after = { ...before, dataset: { ...before.dataset, id: "Changed" } };
  let h: History = { present: before, past: [], future: [after], revision: 1 };
  assert.equal(historyReducer(h, { type: "commit", before, after: structuredClone(before) }), h);
  h = historyReducer(h, { type: "commit", before, after }); assert.equal(h.future.length, 0);
});
test("snapshot navigation retains undo and persistence revision", () => {
  const before = initial(); const h: History = { present: before, past: [before], future: [], revision: 3 };
  const next = historyReducer(h, { type: "navigate", document: { ...before, version: "review" } });
  assert.equal(next.revision, 3); assert.equal(next.past.length, 1); assert.equal(next.present.version, "review");
});
