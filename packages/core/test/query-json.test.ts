import { test } from "node:test";
import assert from "node:assert/strict";
import { createCausalDocument, parseCausalJSON, querySnapshot, serializeCausalJSON, type CausalDataset } from "../src/index.ts";
const dataset: CausalDataset = { id: "evidence", snapshots: [{ id: "v1", nodes: [{ id: "a", label: "A", position: { x: 4, y: 8 }, metadata: { category: "weather", nested: { count: 1 } } }, { id: "b", label: "B" }], edges: [{ id: "ab", source: "a", target: "b", polarity: "negative", evidence: [{ contributor: "source", text: "a, b\nquoted" }] }] }, { id: "v2", nodes: [{ id: "renamed", label: "A new" }], edges: [] }], correspondences: [{ from: "v1", to: "v2", nodes: { a: "renamed" } }] };
test("queries filter domain fields and compose checked, immutable revision-tagged sets", () => {
  const query = querySnapshot(dataset.snapshots[0], 4);
  const weather = query.nodes({ metadata: { category: "weather" } }), all = query.nodes(), edges = query.edges();
  assert.deepEqual(weather.nodes, ["a"]);
  const both = query.union(weather, edges), intersection = query.intersection(all, weather), difference = query.difference(all, weather);
  assert.ok(both.ok && intersection.ok && difference.ok);
  assert.deepEqual(both.value.edges, ["ab"]); assert.deepEqual(intersection.value.nodes, ["a"]); assert.deepEqual(difference.value.nodes, ["b"]);
  assert.equal(query.union({ ...weather, revision: 3 }).ok, false);
  assert.equal(query.union({ ...weather, snapshotId: "v2" }).ok, false);
  assert.equal(query.node("missing"), undefined);
  assert.throws(() => (weather.nodes as string[]).push("b"));
  const copy = query.node("a")!; (copy.metadata!.nested as { count: number }).count = 9;
  assert.equal((query.node("a")!.metadata!.nested as { count: number }).count, 1);
});
test("query results do not become live selections when the document changes", () => {
  const doc = createCausalDocument(dataset), query = querySnapshot(doc.getState().dataset.snapshots[0], 0), target = query.nodes();
  doc.edit("v1").addNode({ label: "New" });
  assert.equal(target.nodes!.length, 2); assert.equal(doc.edit("v1").remove(target).ok, false);
});
test("dataset JSON roundtrips versions, evidence, metadata, positions and correspondences", () => {
  const output = serializeCausalJSON(dataset); assert.ok(output.ok);
  const input = parseCausalJSON(output.value); assert.ok(input.ok); assert.deepEqual(input.value.dataset, dataset);
  input.value.dataset.snapshots[0].nodes[0].label = "Imported"; assert.equal(dataset.snapshots[0].nodes[0].label, "A");
  assert.equal(parseCausalJSON('{"snapshots":[]}').ok, false); assert.equal(parseCausalJSON('not json').ok, false);
});

test("JSON export rejects values it would otherwise lose", () => {
  for (const value of [new Map([["key", "value"]]), new Date(), Infinity]) {
    const bad = structuredClone(dataset); bad.snapshots[0].nodes[0].metadata = { unsupported: value };
    assert.equal(serializeCausalJSON(bad).ok, false);
  }
});
