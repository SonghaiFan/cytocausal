import assert from "node:assert/strict";
import test from "node:test";
import cytoscape, { type Core, type LayoutOptions } from "cytoscape";
import { layouts } from "../src/layouts.ts";
import { curveLinks, measureLayout } from "../src/positions.ts";

/** Runs a test on a fresh graph, destroying it even if the test fails, or its timers keep running. */
async function withGraph(check: (cy: Core) => void | Promise<void>) {
  const cy = causalGraph();
  try {
    await check(cy);
  } finally {
    cy.destroy();
  }
}

/** A small causal graph with a chain, a loop and a loose pair, the shapes layouts must handle. */
function causalGraph(): Core {
  const ids = [
    "rain",
    "flood",
    "damage",
    "repairs",
    "budget",
    "worry",
    "alone",
  ];
  const links = [
    ["rain", "flood"],
    ["flood", "damage"],
    ["damage", "repairs"],
    ["repairs", "budget"],
    ["budget", "repairs"],
    ["damage", "worry"],
  ];
  return cytoscape({
    headless: true,
    styleEnabled: true,
    style: [{ selector: "node", style: { width: 20, height: 20 } }],
    elements: [
      ...ids.map((id, index) => ({
        data: { id },
        position: { x: index * 40, y: (index % 3) * 40 },
      })),
      ...links.map(([source, target]) => ({
        data: { id: `${source}-${target}`, source, target },
      })),
    ],
  });
}

/** Runs a layout and waits for it to finish, however long it takes. */
const run = (cy: Core, layout: LayoutOptions) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${layout.name} never finished`)),
      10_000,
    );
    // Layouts that spread over the viewport need an area, which a headless graph doesn't have
    const area = { x1: 0, y1: 0, w: 300, h: 300 };
    const instance = cy.layout({
      boundingBox: area,
      ...layout,
      animate: false,
      fit: false,
    } as LayoutOptions);
    instance.one("layoutstop", () => {
      clearTimeout(timer);
      resolve();
    });
    instance.run();
  });

for (const [name, layout] of Object.entries(layouts)) {
  test(`${name} lays out a causal graph`, () =>
    withGraph(async (cy) => {
      await run(cy, layout);
      const points = cy.nodes().map((node) => node.position());
      assert.ok(
        points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
        "finite positions",
      );
      const distinct = new Set(
        points.map(({ x, y }) => `${Math.round(x)},${Math.round(y)}`),
      );
      assert.equal(distinct.size, points.length, "no two nodes in one place");
    }));
}

test("dagre runs causes into effects from left to right", () =>
  withGraph(async (cy) => {
    await run(cy, layouts.dagre);
    const x = (id: string) => cy.getElementById(id).position("x");
    assert.ok(
      x("rain") < x("flood") &&
        x("flood") < x("damage") &&
        x("damage") < x("worry"),
    );
  }));

test("breadthfirst grows from what nothing causes", () =>
  withGraph(async (cy) => {
    await run(cy, layouts.breadthfirst);
    const y = (id: string) => cy.getElementById(id).position("y");
    assert.ok(y("rain") < y("flood") && y("flood") < y("damage"));
  }));

test("measured layouts are centred where the graph is, at their own spacing", () => {
  for (const name of [
    "concentric",
    "grid",
    "circle",
    "dagre",
    "breadthfirst",
    "fcose",
    "cose",
    "random",
  ] as const) {
    const cy = causalGraph();
    try {
      const before = cy.nodes().boundingBox({ includeLabels: false });
      const start = cy.nodes().map((node) => ({ ...node.position() }));
      const positions = measureLayout(cy, layouts[name]);
      assert.ok(positions, `${name} is measured in one go`);
      // Nodes are back where they were until the move is animated
      assert.deepEqual(
        cy.nodes().map((node) => ({ ...node.position() })),
        start,
      );
      const xs = Object.values(positions!).map(({ x }) => x);
      const ys = Object.values(positions!).map(({ y }) => y);
      const middle = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2;
      // Nodes are 20 wide, so the centre of their positions sits within that of the box
      assert.ok(Math.abs(middle(xs) - (before.x1 + before.x2) / 2) < 1, `${name} centred across`);
      assert.ok(Math.abs(middle(ys) - (before.y1 + before.y2) / 2) < 1, `${name} centred down`);
      // Not squeezed: nodes keep at least a node's width between them
      const closest = Math.min(
        ...xs.flatMap((x, i) => xs.slice(i + 1).map((other, j) => Math.hypot(x - other, ys[i] - ys[i + 1 + j]))),
      );
      assert.ok(closest >= 20 || name === "random", `${name} keeps nodes apart: ${closest}`);
    } finally {
      cy.destroy();
    }
  }
});

test("links bow in proportion to their length, and repeated links bow further", () => {
  const cy = cytoscape({
    headless: true,
    // Without a layout, Cytoscape runs a grid over the positions given
    layout: { name: "preset" },
    elements: [
      { data: { id: "a" }, position: { x: 0, y: 0 } },
      { data: { id: "b" }, position: { x: 100, y: 0 } },
      { data: { id: "c" }, position: { x: 500, y: 0 } },
      { data: { id: "near", source: "a", target: "b" } },
      { data: { id: "back", source: "b", target: "a" } },
      { data: { id: "far", source: "a", target: "c" } },
      { data: { id: "far-again", source: "a", target: "c" } },
    ],
  });
  try {
    curveLinks(cy);
    const arc = (id: string) => cy.getElementById(id).data("arc") as number;
    assert.equal(arc("near"), 14);
    // The reverse link has the same bow, which bends it to the other side of the line
    assert.equal(arc("back"), arc("near"));
    assert.equal(arc("far"), 60);
    assert.ok(arc("far-again") > arc("far"));
  } finally {
    cy.destroy();
  }
});
