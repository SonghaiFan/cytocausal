import assert from "node:assert/strict";
import test from "node:test";
import { moveMarking, markingRoute } from "../src/marking.ts";
import type { MenuArea } from "../src/overlay.ts";
const first: MenuArea = { node: "a", x: 0, y: 0, radius: 20, inner: 10, sectors: [
  { node: "b", links: ["ab"], from: -.5, to: .5, reach: 120 },
] };
const child: MenuArea = { node: "b", x: 100, y: 0, radius: 20, inner: 10, sectors: [
  { node: "c", links: ["bc"], from: 1, to: 2, reach: 220 },
  { node: "d", links: ["bd"], from: -2, to: -1, reach: 320 },
] };
test("second step rebases its centre, directions and reach on the first chosen node", () => {
  let state = moveMarking({ levels: [{ area: first, chosen: null }] }, { x: 130, y: 0 }, 2, (id, visited) => {
    assert.equal(id, "b"); assert.deepEqual(visited, ["a"]); return child;
  });
  assert.equal(state.levels.length, 2);
  assert.equal(state.levels[1].chosen, null);
  state = moveMarking(state, { x: 100, y: 150 }, 2, () => child);
  assert.equal(state.levels[1].chosen?.node, "c");
  assert.deepEqual(markingRoute(state), { nodes: ["a", "b", "c"], edges: ["ab", "bc"] });
  state = moveMarking(state, { x: 100, y: -150 }, 2, () => child);
  assert.equal(state.levels[1].chosen?.node, "d");
  assert.deepEqual(markingRoute(state).edges, ["ab", "bd"]);
  state = moveMarking(state, { x: 40, y: 0 }, 2, () => child);
  assert.equal(state.levels.length, 1);
  assert.deepEqual(markingRoute(state).edges, ["ab"]);
});
test("depth cap and a dead end do not create another fan", () => {
  const start = { levels: [{ area: first, chosen: null }] };
  assert.equal(moveMarking(start, { x: 130, y: 0 }, 1, () => child).levels.length, 1);
  assert.equal(moveMarking(start, { x: 130, y: 0 }, 2, () => ({ ...child, sectors: [] })).levels.length, 1);
});
