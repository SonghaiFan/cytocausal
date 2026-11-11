import assert from "node:assert/strict";
import test from "node:test";
import {
  diffSnapshots,
  followNodes,
  linkHistory,
  nodeHistory,
  validateDataset,
  versionSteps,
} from "../src/index.ts";
import type { CausalDataset, Polarity, Snapshot } from "../src/index.ts";

const snapshot = (id: string, nodes: string[], edges: [string, string, Polarity?][]): Snapshot => ({
  id,
  nodes: nodes.map((node) => ({ id: node, label: node })),
  edges: edges.map(([source, target, polarity]) => ({ id: `${source}-${target}`, source, target, polarity })),
});

/**
 * Four versions:
 * - V1 → V2: b is renamed b2, and the link from it to c flips to negative
 * - V2 → V3: b2 and c merge into bc, d is removed, e is added
 * - V3 → V4: no correspondence, so ids carry nodes over
 */
const dataset: CausalDataset = {
  id: "history",
  snapshots: [
    snapshot("V1", ["a", "b", "c", "d"], [["a", "b", "positive"], ["b", "c", "positive"]]),
    snapshot("V2", ["a", "b2", "c", "d"], [["a", "b2", "positive"], ["b2", "c", "negative"]]),
    snapshot("V3", ["a", "bc", "e"], [["a", "bc", "positive"], ["bc", "e", "positive"]]),
    snapshot("V4", ["a", "bc", "e"], [["a", "bc", "negative"], ["bc", "e", "positive"]]),
  ],
  correspondences: [
    { from: "V1", to: "V2", nodes: { a: "a", b: "b2", c: "c", d: "d" } },
    { from: "V2", to: "V3", nodes: { a: "a", b2: "bc", c: "bc" } },
  ],
};

test("nodes are followed through every version between two, each step by its correspondence", () => {
  assert.deepEqual(followNodes(dataset, "V1", "V3"), { a: ["a"], b: ["bc"], c: ["bc"] });
  // The last step has no correspondence, so ids carry nodes over it
  assert.deepEqual(followNodes(dataset, "V1", "V4"), { a: ["a"], b: ["bc"], c: ["bc"] });
  // And back the other way, a merge reads as a split
  assert.deepEqual(followNodes(dataset, "V4", "V1"), { a: ["a"], bc: ["b", "c"] });
});

test("a correspondence stated for exactly two versions wins over the steps between them", () => {
  const stated = { ...dataset, correspondences: [...dataset.correspondences!, { from: "V1", to: "V4", nodes: { a: "e" } }] };
  assert.deepEqual(followNodes(stated, "V1", "V4"), { a: ["e"] });
});

test("a node lost along the way matches its id at the end, unless another node became it", () => {
  const lost: CausalDataset = {
    id: "lost",
    snapshots: [snapshot("V1", ["x", "y"], []), snapshot("V2", ["y"], []), snapshot("V3", ["x", "y"], [])],
    correspondences: [{ from: "V1", to: "V2", nodes: { y: "y" } }],
  };
  assert.deepEqual(followNodes(lost, "V1", "V3"), { y: ["y"], x: ["x"] });

  const claimed: CausalDataset = {
    id: "claimed",
    snapshots: [snapshot("V1", ["x", "w"], []), snapshot("V2", ["w2"], []), snapshot("V3", ["x"], [])],
    correspondences: [
      { from: "V1", to: "V2", nodes: { w: "w2" } },
      { from: "V2", to: "V3", nodes: { w2: "x" } },
    ],
  };
  assert.deepEqual(followNodes(claimed, "V1", "V3"), { w: ["x"] });
});

test("a diff across several versions keeps what happened in between", () => {
  const diff = diffSnapshots(dataset, "V1", "V3");
  assert.deepEqual(
    diff.mergedNodes.map(({ from, to }) => [from.map(({ id }) => id), to.id]),
    [[["b", "c"], "bc"]],
  );
  assert.deepEqual(diff.removedNodes.map(({ id }) => id), ["d"]);
  assert.deepEqual(diff.addedNodes.map(({ id }) => id), ["e"]);
});

test("version steps count what each version changed", () => {
  assert.deepEqual(
    versionSteps(dataset).map(({ from, to, counts }) => [from, to, counts]),
    [
      // b renamed, and its link to c flipped
      ["V1", "V2", { added: 0, removed: 0, changed: 2 }],
      // b2 and c merged, d removed, e and its link added; the link b2 → c is inside the merge
      ["V2", "V3", { added: 2, removed: 2, changed: 1 }],
      // a → bc flipped
      ["V3", "V4", { added: 0, removed: 0, changed: 1 }],
    ],
  );
});

test("a node's history goes back to where it began and on to the last version", () => {
  const history = nodeHistory(dataset, "V3", "bc");
  assert.deepEqual(
    history.map(({ version, change, nodes }) => [version, change, nodes.map(({ id }) => id)]),
    [
      ["V1", "start", ["b", "c"]],
      // b was renamed while c stayed, so the step is a rename
      ["V2", "renamed", ["b2", "c"]],
      ["V3", "merged", ["bc"]],
      ["V4", "unchanged", ["bc"]],
    ],
  );
  // The parts say what happened to each node on its own
  assert.deepEqual(
    history[1].parts.map(({ change, before, nodes }) => [change, before[0].id, nodes[0].id]),
    [
      ["renamed", "b", "b2"],
      ["unchanged", "c", "c"],
    ],
  );
});

test("a node's history starts where it was added, and ends where it was removed", () => {
  assert.deepEqual(
    nodeHistory(dataset, "V4", "e").map(({ version, change }) => [version, change]),
    [
      ["V3", "added"],
      ["V4", "unchanged"],
    ],
  );
  assert.deepEqual(
    nodeHistory(dataset, "V1", "d").map(({ version, change, nodes }) => [version, change, nodes.length]),
    [
      ["V1", "start", 1],
      ["V2", "unchanged", 1],
      ["V3", "removed", 0],
    ],
  );
  assert.throws(() => nodeHistory(dataset, "V1", "e"), /no node "e"/);
});

test("a link's history follows its ends through renames and merges", () => {
  assert.deepEqual(
    linkHistory(dataset, "V1", "a-b").map(({ version, change, polarity, links }) => [
      version,
      change,
      polarity,
      links.map(({ id }) => id),
    ]),
    [
      ["V1", "start", "positive", ["a-b"]],
      // b is b2 now, but it's the same link
      ["V2", "unchanged", "positive", ["a-b2"]],
      ["V3", "unchanged", "positive", ["a-bc"]],
      ["V4", "flipped", "negative", ["a-bc"]],
    ],
  );
  // A link added later starts there, and one that ends inside a merge is removed there
  assert.deepEqual(
    linkHistory(dataset, "V4", "bc-e").map(({ version, change }) => [version, change]),
    [
      ["V3", "added"],
      ["V4", "unchanged"],
    ],
  );
  assert.deepEqual(
    linkHistory(dataset, "V1", "b-c").map(({ version, change }) => [version, change]),
    [
      ["V1", "start"],
      ["V2", "flipped"],
      ["V3", "removed"],
    ],
  );
});

test("validation warns where history breaks between two versions", () => {
  assert.deepEqual(validateDataset(dataset), []);
  const renumbered: CausalDataset = {
    id: "renumbered",
    snapshots: [snapshot("V1", ["a", "b", "c", "d"], []), snapshot("V2", ["1", "2", "3", "d"], [])],
  };
  assert.deepEqual(validateDataset(renumbered), [
    "V1->V2: no correspondence, and only 1 of 4 nodes keep their id, so their history can't be followed",
  ]);
  // A correspondence says how they relate, so nothing is lost
  assert.deepEqual(
    validateDataset({ ...renumbered, correspondences: [{ from: "V1", to: "V2", nodes: { a: "1", b: "2", c: "3", d: "d" } }] }),
    [],
  );
});
