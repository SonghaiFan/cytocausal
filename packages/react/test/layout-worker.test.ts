import assert from "node:assert/strict";
import test from "node:test";
import cytoscape from "cytoscape";
import { fcoseLayout, concentricLayout } from "@cytocausal/cytoscape";
import { layoutJob } from "../src/layout-worker.ts";

test("worker jobs preserve sizing callbacks and centrality without cloning functions", () => {
  const cy = cytoscape({ headless: true, styleEnabled: true, elements: [
    { data: { id: "a", score: 1 }, position: { x: 10, y: 20 } },
    { data: { id: "b", score: 0.2 }, position: { x: 90, y: 40 } },
    { data: { id: "ab", source: "a", target: "b" } },
  ], style: [{ selector: "node", style: { width: 40, height: 30 } }], layout: { name: "preset" } });
  try {
    const force = layoutJob(cy, fcoseLayout);
    assert.equal(force.callbacks.idealEdgeLength.ab, 70);
    assert.equal(force.callbacks.nodeRepulsion.a, 14500);
    assert.deepEqual(structuredClone(force), force);
    const rings = layoutJob(cy, concentricLayout);
    assert.deepEqual(rings.callbacks.concentric, { a: 1, b: 0.2 });
    assert.equal(rings.levelWidth, 0.25);
    assert.equal(force.elements[0].data.__layoutWidth, 40);
    assert.throws(() => layoutJob(cy, { name: "grid", unsupported: () => 1 } as any), /not supported/);
  } finally { cy.destroy(); }
});
