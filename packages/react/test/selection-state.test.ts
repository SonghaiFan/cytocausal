import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSelection } from "../src/selection-state.ts";
import type { Snapshot } from "@cytocausal/core";
const snapshot: Snapshot = { id: "v1", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }], edges: [{ id: "ab", source: "a", target: "b" }] };
test("mixed selection operations share IDs and deduplicate without mutating inputs", () => {
  const current = { nodes: ["a"], edges: [] };
  const added = resolveSelection(snapshot, 2, current, { nodes: ["b", "b"], edges: ["ab"] }, "add");
  assert.ok(added.ok); assert.deepEqual(added.value, { snapshotId: "v1", revision: 2, nodes: ["a", "b"], edges: ["ab"] });
  const toggled = resolveSelection(snapshot, 2, added.value, { nodes: ["a"], edges: ["ab"] }, "toggle");
  assert.ok(toggled.ok); assert.deepEqual(toggled.value.nodes, ["b"]); assert.deepEqual(toggled.value.edges, []);
  assert.deepEqual(current, { nodes: ["a"], edges: [] });
});
test("unknown, stale, cross-version and over-limit selections fail before changing anything", () => {
  for (const target of [{ nodes: ["missing"] }, { nodes: ["a"], snapshotId: "v2", revision: 2 }, { nodes: ["a"], snapshotId: "v1", revision: 1 }]) assert.equal(resolveSelection(snapshot, 2, {}, target, "set").ok, false);
  assert.equal(resolveSelection(snapshot, 2, {}, { nodes: ["a", "b"] }, "set", 1).ok, false);
  assert.equal(resolveSelection(snapshot, 2, {}, { edges: ["ab"] }, "set", 0).ok, true);
});
test("replacement drops removed current IDs and clear empties both kinds", () => {
  const next = resolveSelection(snapshot, 0, { nodes: ["gone", "a"], edges: ["ab"] }, {}, "add");
  assert.ok(next.ok); assert.deepEqual(next.value.nodes, ["a"]);
  const clear = resolveSelection(snapshot, 0, next.value, {}, "set");
  assert.ok(clear.ok); assert.deepEqual(clear.value.nodes, []); assert.deepEqual(clear.value.edges, []);
});
