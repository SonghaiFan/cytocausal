import assert from "node:assert/strict";
import test from "node:test";
import cytoscape from "cytoscape";
import { menuPointing, setMenuArea, menuTarget, menuTargetOf, type MenuArea } from "../src/overlay.ts";

const degrees = (value: number) => (value * Math.PI) / 180;
const area: MenuArea = {
  x: 100,
  y: 100,
  radius: 50,
  node: "centre",
  sectors: [
    { node: "east", links: ["centre->east"], from: degrees(-45), to: degrees(45), reach: 200 },
    // A sector crossing the back of the circle, where angles wrap from 180° to -180°
    { node: "west", links: ["west->centre", "centre->west"], from: degrees(150), to: degrees(210), reach: 120 },
  ],
};
const at = (angle: number, distance: number) => ({
  x: area.x + distance * Math.cos(degrees(angle)),
  y: area.y + distance * Math.sin(degrees(angle)),
});

test("a point in a sector, past the menu and short of its reach, picks that sector's node", () => {
  assert.equal(menuTarget(area, at(0, 120)), "east");
  assert.equal(menuTarget(area, at(40, 199)), "east");
  assert.equal(menuTarget(area, at(180, 100)), "west");
  assert.equal(menuTarget(area, at(-160, 100)), "west");
});

test("inside the menu, past a sector's reach, or between sectors, nothing is picked", () => {
  assert.equal(menuTarget(area, at(0, 40)), null);
  assert.equal(menuTarget(area, at(0, 210)), null);
  assert.equal(menuTarget(area, at(90, 100)), null);
  assert.equal(menuTarget(area, at(180, 130)), null);
  assert.equal(menuTarget({ ...area, sectors: undefined }, at(0, 120)), null);
  assert.equal(menuTarget(null, at(0, 120)), null);
});

test("a linked node, and the links between it and the selected node, lead to it", () => {
  assert.equal(menuTargetOf(area, { node: "east" }), "east");
  assert.equal(menuTargetOf(area, { link: "centre->east" }), "east");
  assert.equal(menuTargetOf(area, { link: "west->centre" }), "west");
  // Anything else keeps its own hover and click
  assert.equal(menuTargetOf(area, { node: "elsewhere" }), null);
  assert.equal(menuTargetOf(area, { link: "east->elsewhere" }), null);
  assert.equal(menuTargetOf(area, { node: "centre" }), null);
  assert.equal(menuTargetOf({ ...area, sectors: undefined }, { node: "east" }), null);
});


test("the modal backdrop uses only the fan, regardless of element identity or highlight", () => {
  const cy = cytoscape({ headless: true, elements: [
    { data: { id: "centre" }, position: { x: 100, y: 100 } },
    { data: { id: "east" } },
    { data: { id: "elsewhere" } },
    { data: { id: "centre->east", source: "centre", target: "east" } },
    { data: { id: "unrelated", source: "east", target: "elsewhere" } },
  ], layout: { name: "preset" } });
  cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
  setMenuArea(cy, area);
  for (const id of ["east", "elsewhere", "centre->east", "unrelated"]) {
    const element = cy.getElementById(id);
    for (const dimmed of [true, false]) {
      element.toggleClass("dimmed", dimmed);
      assert.deepEqual(menuPointing(cy, element, at(180, 100)), { leadsTo: "west", backdrop: true });
      assert.deepEqual(menuPointing(cy, element, at(90, 100)), { leadsTo: null, backdrop: true });
    }
  }
  // Tracing intentionally restores choosing another node.
  setMenuArea(cy, { ...area, sectors: undefined });
  assert.deepEqual(menuPointing(cy, cy.getElementById("east"), at(90, 100)), { leadsTo: null, backdrop: false });
  cy.destroy();
});
