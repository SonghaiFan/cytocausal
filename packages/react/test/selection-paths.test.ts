import assert from "node:assert/strict";
import test from "node:test";
import { selectionPaths } from "../src/selection-paths.ts";
const graph = (links: [string, string, string][]) => ({ id: "test",
  nodes: [...new Set(links.flatMap(([, a, b]) => [a, b]))].map(id => ({ id, label: id })),
  edges: links.map(([id, source, target]) => ({ id, source, target })),
});
const edgesOf = (result: ReturnType<typeof selectionPaths>) => [...new Set(result.flatMap(s => s.paths.flatMap(p => p.edges)))].sort();
test("selects one shortest directed path, not longer alternatives or parallel edges", () => {
  const snapshot = graph([["ab", "a", "b"], ["ab2", "a", "b"], ["bc", "b", "c"], ["ax", "a", "x"], ["xy", "x", "y"], ["yc", "y", "c"]]);
  assert.deepEqual(edgesOf(selectionPaths(snapshot, ["c", "a"])), ["ab", "bc"]);
});
test("connects multiple terminals sparsely and keeps disconnected selections explicit", () => {
  const snapshot = graph([["ab", "a", "b"], ["bc", "b", "c"], ["ac", "a", "c"], ["ii", "isolated", "isolated"]]);
  const result = selectionPaths(snapshot, ["c", "b", "a", "isolated", "a", "missing"]);
  assert.equal(edgesOf(result).length, 2);
  assert.equal(result.filter(s => s.paths.length).length, 2);
  assert.equal(result.filter(s => !s.paths.length).length, 1);
  for (const search of result) for (const path of search.paths) path.edges.forEach((id, i) => {
    const edge = snapshot.edges.find(e => e.id === id)!;
    assert.equal(edge.source, path.nodes[i]); assert.equal(edge.target, path.nodes[i + 1]);
  });
});
test("reuses shared intermediates and is independent of selection order", () => {
  const snapshot = graph([["ax", "a", "x"], ["xb", "x", "b"], ["xc", "x", "c"]]);
  const result = selectionPaths(snapshot, ["a", "b", "c"]);
  assert.deepEqual(edgesOf(result), ["ax", "xb", "xc"]);
  assert.deepEqual(selectionPaths(snapshot, ["c", "b", "a"]), result);
});
test("does not reverse arrows to invent a directed path", () => {
  const snapshot = graph([["ax", "a", "x"], ["bx", "b", "x"]]);
  assert.deepEqual(edgesOf(selectionPaths(snapshot, ["a", "b"])), []);
});
test("shortest path is not silently limited to eight nodes", () => {
  const snapshot = graph(Array.from({ length: 12 }, (_, i) => [`e${i}`, `${i}`, `${i + 1}`]));
  assert.equal(edgesOf(selectionPaths(snapshot, ["0", "12"])).length, 12);
});
