import { test } from "node:test";
import assert from "node:assert/strict";
import cytoscape from "cytoscape";
import { createCausalDocument } from "@cytocausal/core";
import { toElements } from "../src/elements.ts";
test("rendering and dragging saved positions never mutate an immutable document", () => {
  const doc = createCausalDocument({ id: "test", snapshots: [{ id: "draft", nodes: [{ id: "a", label: "A", position: { x: 10, y: 20 }, metadata: { nested: { score: 1 } } }], edges: [] }] });
  const snapshot = doc.getState().dataset.snapshots[0], elements = toElements(snapshot);
  const cy = cytoscape({ headless: true, elements: [...elements.nodes, ...elements.edges], layout: { name: "preset" } });
  cy.getElementById("a").position({ x: 80, y: 90 });
  cy.getElementById("a").data("nested").score = 5;
  assert.deepEqual(snapshot.nodes[0].position, { x: 10, y: 20 });
  assert.deepEqual(snapshot.nodes[0].metadata?.nested, { score: 1 });
  assert.equal(doc.getState().revision, 0); cy.destroy();
});
