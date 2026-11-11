import assert from "node:assert/strict";
import test from "node:test";
import { directionCells } from "../src/radial.ts";

const degrees = (radians: number) => Math.round((radians * 180) / Math.PI);
const radians = (...values: number[]) => values.map((value) => (value * Math.PI) / 180);
const options = { min: radians(20)[0], reach: radians(60)[0] };
const cells = (...bearings: number[]) =>
  directionCells(radians(...bearings), options).map(({ from, to, at }) => [degrees(from), degrees(to), degrees(at)]);

test("each neighbour gets the angles nearest its bearing, up to the midpoints", () => {
  assert.deepEqual(cells(0, 90, 180, 270), [
    [-45, 45, 0],
    [45, 135, 90],
    [135, 225, 180],
    [225, 315, 270],
  ]);
  // Uneven gaps make uneven cells, split half way between neighbours
  assert.deepEqual(cells(0, 40, 200), [
    [-60, 20, 0],
    [20, 100, 40],
    [140, 260, 200],
  ]);
});

test("with few neighbours, a cell reaches no further than its limit", () => {
  assert.deepEqual(cells(30), [[-30, 90, 30]]);
  assert.deepEqual(cells(0, 180), [
    [-60, 60, 0],
    [120, 240, 180],
  ]);
});

test("neighbours lying the same way are spread so each cell stays usable", () => {
  const result = directionCells(radians(10, 12, 14), options);
  for (const { from, to } of result) assert.ok(degrees(to - from) >= 20);
  // Cells never overlap, and each bearing stays inside its own cell
  result.forEach(({ from, to, at }, index) => {
    assert.ok(at >= from && at <= to);
    if (index > 0) assert.ok(from >= result[index - 1].to - 1e-9);
  });
});

test("cells cover the ring once, whatever the bearings", () => {
  for (let trial = 0; trial < 200; trial++) {
    const count = 1 + Math.floor(Math.random() * 20);
    const bearings = Array.from({ length: count }, () => Math.random() * 2 * Math.PI - Math.PI).sort((a, b) => a - b);
    const result = directionCells(bearings, options);
    const total = result.reduce((sum, { from, to }) => sum + (to - from), 0);
    assert.ok(total <= 2 * Math.PI + 1e-9, "no overlap");
    result.forEach(({ from, to, at }, index) => {
      assert.ok(to > from && at >= from - 1e-9 && at <= to + 1e-9);
      if (index > 0) assert.ok(from >= result[index - 1].to - 1e-9);
    });
    assert.ok(result[result.length - 1].to <= result[0].from + 2 * Math.PI + 1e-9);
  }
});

// Dense graphs often have several neighbours within a few degrees. The outer
// navigation fans must use real bearings rather than enforcing a minimum width.
test("dense navigation fans contain their real bearings and choose the nearest direction", () => {
  for (const values of [[-150, -120, -119, -118, -100, 170], [-179, -178, 170, 179]]) {
    const bearings = radians(...values);
    const result = directionCells(bearings, { ...options, min: 0 });
    result.forEach(({ from, to }, index) => {
      assert.ok(bearings[index] >= from && bearings[index] <= to);
    });
    for (let angle = -Math.PI; angle < Math.PI; angle += 0.01) {
      const distances = bearings.map((bearing) => Math.abs(Math.atan2(Math.sin(angle - bearing), Math.cos(angle - bearing))));
      const nearest = distances.indexOf(Math.min(...distances));
      const hit = result.findIndex(({ from, to }) => ((angle - from + 4 * Math.PI) % (2 * Math.PI)) <= to - from);
      assert.equal(hit, distances[nearest] <= options.reach ? nearest : -1);
    }
  }
});
