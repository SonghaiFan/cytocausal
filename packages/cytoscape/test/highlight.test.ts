import assert from "node:assert/strict";
import test from "node:test";
import cytoscape from "cytoscape";
import { highlightCausalNeighbours } from "../src/highlight.ts";

test("neighbour highlights preserve other classes and do not restyle unchanged elements", () => {
  const cy = cytoscape({ headless: true, styleEnabled: true, elements: [
    { data: { id: "a" }, classes: "custom" }, { data: { id: "b" } }, { data: { id: "c" } },
    { data: { id: "ab", source: "a", target: "b" } },
  ] });
  try {
    highlightCausalNeighbours(cy, ["a"]);
    assert.ok(cy.$id("a").hasClass("focus"));
    assert.ok(cy.$id("a").hasClass("custom"));
    assert.ok(cy.$id("b").hasClass("effect"));
    assert.ok(cy.$id("ab").hasClass("effect-link"));
    assert.ok(cy.$id("c").hasClass("dimmed"));
    let restyled = 0;
    cy.on("style", () => restyled++);
    highlightCausalNeighbours(cy, ["a"]);
    assert.equal(restyled, 0, "an identical focus should not invalidate the renderer's style cache");
    highlightCausalNeighbours(cy, ["b"]);
    assert.ok(cy.$id("a").hasClass("cause"));
    assert.ok(cy.$id("b").hasClass("focus"));
    highlightCausalNeighbours(cy, []);
    assert.deepEqual(cy.$id("a").classes(), ["custom"]);
    assert.ok(cy.elements(".dimmed").length === 0);
  } finally { cy.destroy(); }
});
