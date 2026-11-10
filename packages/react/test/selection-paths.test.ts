import assert from "node:assert/strict";
import test from "node:test";
import { selectionPaths } from "../src/selection-paths.ts";

test("multi-selection covers every directed pair, including disconnected nodes", () => {
  const snapshot = { id: "test", nodes: ["a", "b", "c", "isolated"].map(id => ({ id, label: id })),
    edges: [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c" }] };
  const searches = selectionPaths(snapshot, ["a", "b", "c", "isolated", "a", "missing"]);
  assert.equal(searches.length, 12);
  assert.deepEqual(searches.find(s => s.start === "a" && s.end === "c")?.paths[0].edges, ["ab", "bc"]);
  assert.equal(searches.find(s => s.start === "b" && s.end === "c")?.paths.length, 1);
  assert.ok(searches.filter(s => s.start === "isolated" || s.end === "isolated").every(s => s.paths.length === 0));
});
