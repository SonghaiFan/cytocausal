import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshots, findCausalPaths, findFeedbackLoops, validateDataset } from "@cytocausal/core";
import { dataset, importGarden, versionedDataset } from "../src/components/examples/data.ts";

test("tutorial imports evidence and a complete balancing loop", () => {
  assert.deepEqual(validateDataset(dataset), []);
  const result = findFeedbackLoops(dataset.snapshots[0], { maxLength: 4, limit: 20 });
  assert.equal(result.complete, true);
  assert.deepEqual(result.loops.map(loop => loop.type), ["balancing"]);
  assert.equal(dataset.snapshots[0].edges[0].evidence?.[0].contributor, "gardener");
  assert.equal(findCausalPaths(dataset.snapshots[0], "node:moisture", "node:use").paths.length, 1);
});
test("tutorial rejects malformed values and dangling endpoints before rendering", () => {
  assert.throws(() => importGarden(null), /object/);
  assert.throws(() => importGarden({ variables: [], relationships: [] }), /at least one/);
  assert.throws(() => importGarden({ variables: [{id:"a",label:"A"}], relationships: [{id:"a",from:"a",to:"missing",sign:"+"}] }), /missing node/);
  assert.throws(() => importGarden({ variables: [{id:"a",label:"A"}], relationships: [{id:"b",from:"a",to:"a",sign:"maybe"}] }), /sign/);
});
test("reviewed identity remains a rename rather than removal and addition", () => {
  assert.deepEqual(validateDataset(versionedDataset), []);
  const diff = diffSnapshots(versionedDataset, "draft", "reviewed");
  assert.equal(diff.renamedNodes.length, 1);
  assert.equal(diff.addedNodes.length + diff.removedNodes.length + diff.addedLinks.length + diff.removedLinks.length, 0);
});
