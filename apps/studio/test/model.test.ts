import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteNode, emptyDataset, parseDataset } from "../src/model.ts";
const sample = () => ({ id: "test", snapshots: [{ id: "draft", nodes: [{id:"a",label:"A"},{id:"b",label:"B"}], edges: [{id:"ab",source:"a",target:"b",polarity:"positive",evidence:[{text:"A claim",contributor:"person"}]}] }] });
test("imports preserve evidence and reject malformed data", () => {
  assert.deepEqual(parseDataset(sample()), sample());
  assert.deepEqual(parseDataset(emptyDataset()), emptyDataset());
  assert.throws(() => parseDataset(null));
  const duplicate = sample(); duplicate.snapshots[0].edges[0].id = "a";
  assert.throws(() => parseDataset(duplicate), /Duplicate/);
  const missing = sample(); missing.snapshots[0].edges[0].target = "missing";
  assert.throws(() => parseDataset(missing), /missing node/);
  assert.throws(() => parseDataset({id:"test",snapshots:[]}));
});
test("deleting a node removes incident edges and correspondence entries", () => {
  const data = parseDataset(sample());
  data.snapshots.push({id:"review",nodes:[{id:"a2",label:"A2"}],edges:[]});
  data.correspondences=[{from:"draft",to:"review",nodes:{a:"a2"}}];
  const result = deleteNode(data,"draft","a");
  assert.equal(result.snapshots[0].edges.length,0);
  assert.deepEqual(result.correspondences?.[0].nodes,{});
  assert.equal(data.snapshots[0].nodes.length,2);
});
