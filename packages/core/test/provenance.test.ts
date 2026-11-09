import assert from "node:assert/strict";
import test from "node:test";
import {
  combineDatasets,
  contributorsOf,
  filterByContributors,
  linksInto,
  listContributors,
  searchNodes,
  supportOf,
  validateDataset,
  type CausalDataset,
  type Polarity,
} from "../src/index.ts";

const person = (id: string, nodes: [string, string][], links: [string, string, Polarity][]): CausalDataset => ({
  id,
  snapshots: [
    {
      id: "final",
      nodes: nodes.map(([nodeId, key]) => ({ id: nodeId, label: key.toUpperCase(), metadata: { key } })),
      edges: links.map(([source, target, polarity]) => ({ id: `${source}-${target}`, source, target, polarity })),
    },
  ],
});

const byKey = { key: (node: { metadata?: Record<string, unknown> }) => String(node.metadata!.key) };

test("contributors are listed once, in order", () => {
  const item = { evidence: [{ contributor: "b" }, { text: "no one" }, { contributor: "a" }, { contributor: "b" }] };
  assert.deepEqual(contributorsOf(item), ["b", "a"]);
  assert.equal(supportOf(item), 2);
  assert.equal(supportOf({}), 0);
});

test("combining merges nodes by key and counts who stated each link", () => {
  // The same concept has different ids for each person, as in Perspectiva
  const { dataset, issues } = combineDatasets(
    [
      person("p1", [["1", "rain"], ["2", "flood"]], [["1", "2", "positive"]]),
      person("p2", [["7", "rain"], ["8", "flood"], ["9", "damage"]], [["7", "8", "positive"], ["8", "9", "positive"]]),
    ],
    { id: "workshop", ...byKey },
  );
  assert.deepEqual(issues, []);
  assert.deepEqual(validateDataset(dataset), []);
  const [{ nodes, edges }] = dataset.snapshots;
  assert.deepEqual(nodes.map(({ id }) => id), ["rain", "flood", "damage"]);
  assert.deepEqual(edges.map(({ id }) => id), ["rain->flood", "flood->damage"]);
  assert.deepEqual(contributorsOf(edges[0]), ["p1", "p2"]);
  assert.deepEqual(contributorsOf(nodes[2]), ["p2"]);
});

test("people who disagree on polarity get a link each", () => {
  const { dataset } = combineDatasets(
    [
      person("p1", [["a", "a"], ["b", "b"]], [["a", "b", "positive"]]),
      person("p2", [["a", "a"], ["b", "b"]], [["a", "b", "negative"]]),
    ],
    { id: "w" },
  );
  const { edges } = dataset.snapshots[0];
  assert.deepEqual(edges.map(({ id, polarity }) => [id, polarity]), [
    ["a->b:positive", "positive"],
    ["a->b:negative", "negative"],
  ]);
  assert.deepEqual(linksInto(dataset.snapshots[0], "b").map(({ node, links }) => [node.id, links.length]), [["a", 2]]);
});

test("combining reports a key with two labels", () => {
  const { issues } = combineDatasets(
    [
      person("p1", [["95", "95"]], []),
      { ...person("p2", [["95", "95"]], []), snapshots: [{ id: "final", nodes: [{ id: "95", label: "Other" }], edges: [] }] },
    ],
    { id: "w" },
  );
  assert.deepEqual(issues, ['final: 95 is "95" in p1 and "Other" in p2']);
});

test("combining follows correspondences through keys, and reports conflicts", () => {
  const versions = (id: string, from: string, to: string, target: string): CausalDataset => ({
    id,
    snapshots: [
      { id: "V1", nodes: [{ id: from, label: "x", metadata: { key: "old" } }], edges: [] },
      { id: "final", nodes: [{ id: to, label: target, metadata: { key: target } }], edges: [] },
    ],
    correspondences: [{ from: "V1", to: "final", nodes: { [from]: to } }],
  });
  const agreed = combineDatasets([versions("p1", "1", "2", "new"), versions("p2", "5", "6", "new")], { id: "w", ...byKey });
  assert.deepEqual(agreed.dataset.correspondences, [{ from: "V1", to: "final", nodes: { old: "new" } }]);
  assert.deepEqual(agreed.issues, []);

  const clash = combineDatasets([versions("p1", "1", "2", "new"), versions("p2", "5", "6", "other")], { id: "w", ...byKey });
  assert.deepEqual(clash.issues, ["V1->final: old becomes new elsewhere, but other in p2"]);
});

test("filtering keeps what the chosen people stated", () => {
  const { dataset } = combineDatasets(
    [
      person("p1", [["a", "a"], ["b", "b"]], [["a", "b", "positive"]]),
      person("p2", [["b", "b"], ["c", "c"], ["d", "d"]], [["b", "c", "positive"]]),
    ],
    { id: "w" },
  );
  const [snapshot] = dataset.snapshots;
  const mine = filterByContributors(snapshot, ["p1"]);
  assert.deepEqual(mine.nodes.map(({ id }) => id), ["a", "b"]);
  assert.deepEqual(mine.edges.map(({ id }) => id), ["a->b"]);
  assert.deepEqual(filterByContributors(snapshot, ["p2"]).nodes.map(({ id }) => id), ["b", "c", "d"]);
  assert.deepEqual(listContributors(snapshot), [
    { contributor: "p1", nodes: 2, links: 1 },
    { contributor: "p2", nodes: 3, links: 1 },
  ]);
});

test("contributors sort in natural order", () => {
  const snapshot = {
    id: "s",
    nodes: ["citizen_10", "citizen_2"].map((contributor) => ({ id: contributor, label: "", evidence: [{ contributor }] })),
    edges: [],
  };
  assert.deepEqual(listContributors(snapshot).map(({ contributor }) => contributor), ["citizen_2", "citizen_10"]);
});

test("search skips evidence without text", () => {
  const nodes = [{ id: "1", label: "x", evidence: [{ contributor: "p1" }, { text: "heavy rain" }] }];
  assert.equal(searchNodes(nodes, "rain")[0].evidence, "heavy rain");
});
