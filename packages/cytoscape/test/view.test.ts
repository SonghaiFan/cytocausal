import assert from "node:assert/strict";
import test from "node:test";
import cytoscape from "cytoscape";
import { centerView, fitBox, zoomBy } from "../src/view.ts";

const graph = () => cytoscape({ headless: true, styleEnabled: true, minZoom: 0.1, maxZoom: 4 });

test("centering uses the final bounded zoom and clears older camera moves", () => {
  const cy = graph();
  cy.animate({ pan: { x: 500, y: 500 } }, { duration: 1000 });
  cy.animate({ pan: { x: -500, y: -500 } }, { duration: 1000 });
  assert.equal(cy.animated(), true);
  centerView(cy, { x: 80, y: -20 }, 10);
  assert.equal(cy.zoom(), 4);
  assert.deepEqual(cy.pan(), { x: cy.width() / 2 - 320, y: cy.height() / 2 + 80 });
  assert.equal(cy.animated(), false);
  cy.destroy();
});

test("zoom keeps the same model point at the centre, including at zoom limits", () => {
  const cy = graph();
  cy.viewport({ zoom: 2, pan: { x: 35, y: -70 } });
  const centre = () => ({ x: (cy.width() / 2 - cy.pan().x) / cy.zoom(), y: (cy.height() / 2 - cy.pan().y) / cy.zoom() });
  const before = centre();
  zoomBy(cy, 10);
  assert.equal(cy.zoom(), 4);
  assert.deepEqual(centre(), before);
  zoomBy(cy, 0.001);
  assert.equal(cy.zoom(), 0.1);
  assert.ok(Math.abs(centre().x - before.x) < 1e-9);
  assert.ok(Math.abs(centre().y - before.y) < 1e-9);
  cy.destroy();
});

test("an empty fit leaves the view intact and still completes", () => {
  const cy = graph();
  const before = { zoom: cy.zoom(), pan: { ...cy.pan() } };
  let completed = false;
  fitBox(cy, { x1: Infinity, x2: -Infinity, y1: Infinity, y2: -Infinity, w: -Infinity, h: -Infinity }, 0, () => { completed = true; });
  assert.deepEqual({ zoom: cy.zoom(), pan: cy.pan() }, before);
  assert.equal(completed, true);
  cy.destroy();
});
