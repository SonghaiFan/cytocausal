import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSnapshot,
  changeMarks,
  diffSnapshots,
  findCausalPaths,
  findFeedbackLoops,
  getSnapshot,
  importExplorer,
  importPerspectiva,
  searchNodes,
  validateDataset,
} from "../src/index.ts";
import type { CausalDataset, CausalEdge, Snapshot } from "../src/index.ts";

const node = (id: string) => ({ id, label: id });
const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });

const snapshot = (id: string, nodes: string[], edges: [string, string][]): Snapshot => ({
  id,
  nodes: nodes.map(node),
  edges: edges.map(([source, target]) => edge(source, target)),
});

test("a consistent dataset has no issues", () => {
  const dataset: CausalDataset = {
    id: "demo",
    snapshots: [snapshot("V1", ["a", "b"], [["a", "b"]]), snapshot("final", ["c"], [])],
    correspondences: [{ from: "V1", to: "final", nodes: { a: "c", b: "c" } }],
  };
  assert.deepEqual(validateDataset(dataset), []);
});

test("validation reports structural problems", () => {
  const issues = validateDataset({
    id: "demo",
    snapshots: [snapshot("V1", ["a", "a"], [["a", "z"]])],
    correspondences: [
      { from: "V1", to: "gone", nodes: {} },
      { from: "V1", to: "V1", nodes: { q: "a" } },
    ],
  });
  assert.deepEqual(issues, [
    "V1: duplicate node a",
    "V1: edge a-z references missing node z",
    "correspondence references missing snapshot gone",
    "V1->V1: missing source node q",
  ]);
});

test("feedback groups only contain nodes on a directed cycle", () => {
  const { feedbackGroups } = analyzeSnapshot(
    snapshot("s", ["a", "b", "c", "d"], [["a", "b"], ["b", "c"], ["c", "b"], ["c", "d"]]),
  );
  assert.deepEqual(feedbackGroups.map((group) => group.sort()), [["b", "c"]]);
});

test("betweenness follows edge direction", () => {
  const { betweenness } = analyzeSnapshot(snapshot("s", ["a", "b", "c"], [["a", "b"], ["b", "c"]]));
  assert.ok(betweenness.b > 0);
  assert.equal(betweenness.a, 0);
  assert.equal(betweenness.c, 0);

  const star = analyzeSnapshot(snapshot("s", ["a", "b", "c"], [["a", "b"], ["c", "b"]]));
  assert.equal(star.betweenness.b, 0);
});

test("repeated links do not break analysis", () => {
  const graph = snapshot("s", ["a", "b"], [["a", "b"], ["a", "b"]]);
  assert.deepEqual(analyzeSnapshot(graph).feedbackGroups, []);
});

const signed = (links: [string, string, "positive" | "negative"][]): Snapshot => ({
  id: "s",
  nodes: [...new Set(links.flatMap(([source, target]) => [source, target]))].map(node),
  edges: links.map(([source, target, polarity]) => ({ ...edge(source, target), polarity })),
});

test("each loop is found once, shortest first", () => {
  const { loops, complete } = findFeedbackLoops(
    snapshot("s", ["a", "b", "c"], [["a", "b"], ["b", "a"], ["b", "c"], ["c", "a"]]),
  );
  assert.deepEqual(loops.map((loop) => loop.nodes), [["a", "b"], ["a", "b", "c"]]);
  assert.deepEqual(loops[1].edges, ["a-b", "b-c", "c-a"]);
  assert.equal(complete, true);
});

test("graphs without cycles have no loops", () => {
  assert.deepEqual(findFeedbackLoops(snapshot("s", ["a", "b"], [["a", "b"]])).loops, []);
});

test("a link from a node to itself is a loop", () => {
  const { loops } = findFeedbackLoops(signed([["a", "a", "negative"]]));
  assert.deepEqual(loops.map(({ nodes, type }) => [nodes, type]), [[["a"], "balancing"]]);
});

test("loop type follows the number of negative links", () => {
  const typeOf = (links: [string, string, "positive" | "negative"][]) =>
    findFeedbackLoops(signed(links)).loops[0].type;
  assert.equal(typeOf([["a", "b", "positive"], ["b", "a", "positive"]]), "reinforcing");
  assert.equal(typeOf([["a", "b", "negative"], ["b", "a", "positive"]]), "balancing");
  assert.equal(typeOf([["a", "b", "negative"], ["b", "a", "negative"]]), "reinforcing");
});

test("loops without polarity are unknown", () => {
  const { loops } = findFeedbackLoops(snapshot("s", ["a", "b"], [["a", "b"], ["b", "a"]]));
  assert.equal(loops[0].type, "unknown");
});

test("searching through a node finds only its loops", () => {
  const graph = snapshot("s", ["a", "b", "c", "d"], [["a", "b"], ["b", "a"], ["c", "d"], ["d", "c"]]);
  assert.deepEqual(findFeedbackLoops(graph, { through: "d" }).loops[0].nodes, ["d", "c"]);
  assert.equal(findFeedbackLoops(graph, { through: "d" }).loops.length, 1);
});

test("limits are reported instead of hiding loops silently", () => {
  const graph = snapshot("s", ["a", "b", "c"], [["a", "b"], ["b", "a"], ["b", "c"], ["c", "a"]]);
  const short = findFeedbackLoops(graph, { maxLength: 2 });
  assert.equal(short.loops.length, 1);
  assert.equal(short.complete, false);
  const capped = findFeedbackLoops(graph, { limit: 1 });
  assert.equal(capped.loops.length, 1);
  assert.equal(capped.complete, false);
  assert.equal(findFeedbackLoops(graph, { maxLength: 3 }).complete, true);
});

test("a capped loop list keeps the shortest loops", () => {
  // The search meets the three-node loop first, through a's first link
  const graph = snapshot("s", ["a", "b", "c", "d"], [["a", "b"], ["b", "c"], ["c", "a"], ["a", "d"], ["d", "a"]]);
  const capped = findFeedbackLoops(graph, { limit: 1 });
  assert.deepEqual(capped.loops.map((loop) => loop.nodes), [["a", "d"]]);
  assert.equal(capped.complete, false);
  assert.equal(findFeedbackLoops(graph, { limit: 2 }).complete, true);
});

test("search matches ids, labels and evidence, with labels first", () => {
  const nodes = [
    { id: "1", label: "Heavy rain", evidence: [{ text: "storm season" }] },
    { id: "2", label: "Floods", evidence: [{ text: "after heavy rain" }] },
    { id: "3", label: "Storm damage" },
  ];
  const ids = (text: string) => searchNodes(nodes, text).map(({ node }) => node.id);

  assert.deepEqual(ids("rain"), ["1", "2"]);
  assert.deepEqual(ids("  STORM "), ["3", "1"]);
  assert.equal(searchNodes(nodes, "rain")[1].evidence, "after heavy rain");
  assert.equal(searchNodes(nodes, "rain")[0].evidence, undefined);
  assert.deepEqual(ids("2"), ["2"]);
  assert.deepEqual(ids("r"), []);
  assert.deepEqual(ids(""), []);
});

test("paths follow link direction, shortest first", () => {
  const graph = snapshot("s", ["a", "b", "c", "d"], [["a", "b"], ["b", "c"], ["a", "c"], ["c", "d"]]);
  const { paths, complete } = findCausalPaths(graph, "a", "c");
  assert.deepEqual(paths.map((path) => path.nodes), [["a", "c"], ["a", "b", "c"]]);
  assert.deepEqual(paths[1].edges, ["a-b", "b-c"]);
  assert.equal(complete, true);
  assert.deepEqual(findCausalPaths(graph, "c", "a").paths, []);
  assert.deepEqual(findCausalPaths(graph, "a", "a").paths, []);
});

test("paths don't repeat a node, and limits are reported", () => {
  const graph = snapshot("s", ["a", "b", "c"], [["a", "b"], ["b", "a"], ["b", "c"]]);
  assert.deepEqual(findCausalPaths(graph, "a", "c").paths[0].nodes, ["a", "b", "c"]);
  assert.equal(findCausalPaths(graph, "a", "c").paths.length, 1);

  const short = findCausalPaths(graph, "a", "c", { maxLength: 2 });
  assert.deepEqual(short.paths, []);
  assert.equal(short.complete, false);
});

test("a capped path list keeps the shortest paths", () => {
  const graph = snapshot("s", ["a", "b", "c"], [["a", "b"], ["b", "c"], ["a", "c"]]);
  const capped = findCausalPaths(graph, "a", "c", { limit: 1 });
  assert.deepEqual(capped.paths.map((path) => path.nodes), [["a", "c"]]);
  assert.equal(capped.complete, false);
  assert.equal(findCausalPaths(graph, "a", "c", { limit: 2 }).complete, true);
});

const versions = (correspondence?: Record<string, string>): CausalDataset => ({
  id: "d",
  snapshots: [
    {
      id: "V1",
      nodes: [node("a"), node("b"), node("c"), node("gone")],
      edges: [
        { ...edge("a", "b"), polarity: "positive" },
        { ...edge("b", "c"), polarity: "positive" },
        { ...edge("a", "gone"), polarity: "positive" },
      ],
    },
    {
      id: "final",
      nodes: [node("a"), { id: "b2", label: "B renamed" }, node("c"), node("new")],
      edges: [
        { ...edge("a", "b2"), polarity: "negative" },
        { ...edge("b2", "c"), polarity: "positive" },
        { ...edge("c", "new"), polarity: "positive" },
      ],
    },
  ],
  correspondences: correspondence ? [{ from: "V1", to: "final", nodes: correspondence }] : [],
});

test("a diff follows renamed nodes and finds what changed", () => {
  const diff = diffSnapshots(versions({ a: "a", b: "b2", c: "c" }), "V1", "final");
  assert.deepEqual(diff.addedNodes.map(({ id }) => id), ["new"]);
  assert.deepEqual(diff.removedNodes.map(({ id }) => id), ["gone"]);
  assert.deepEqual(diff.renamedNodes.map(({ from, to }) => [from.id, to.id]), [["b", "b2"]]);
  assert.deepEqual(diff.addedLinks.map(({ id }) => id), ["c-new"]);
  assert.deepEqual(diff.removedLinks.map(({ id }) => id), ["a-gone"]);
  assert.deepEqual(diff.changedLinks.map(({ polarity }) => polarity), [["positive", "negative"]]);
});

test("a diff works in reverse", () => {
  const diff = diffSnapshots(versions({ a: "a", b: "b2", c: "c" }), "final", "V1");
  assert.deepEqual(diff.addedNodes.map(({ id }) => id), ["gone"]);
  assert.deepEqual(diff.removedNodes.map(({ id }) => id), ["new"]);
});

test("a diff reports merged nodes", () => {
  const dataset: CausalDataset = {
    id: "d",
    snapshots: [snapshot("V1", ["a", "b"], []), snapshot("final", ["ab"], [])],
    correspondences: [{ from: "V1", to: "final", nodes: { a: "ab", b: "ab" } }],
  };
  const diff = diffSnapshots(dataset, "V1", "final");
  assert.deepEqual(diff.mergedNodes.map(({ from, to }) => [from.map(({ id }) => id), to.id]), [
    [["a", "b"], "ab"],
  ]);
  assert.deepEqual(diff.addedNodes, []);
  assert.deepEqual(diff.removedNodes, []);
});

test("without a correspondence, a diff matches nodes by id", () => {
  const diff = diffSnapshots(versions(), "V1", "final");
  assert.deepEqual(diff.addedNodes.map(({ id }) => id), ["b2", "new"]);
  assert.deepEqual(diff.removedNodes.map(({ id }) => id), ["b", "gone"]);
});

test("Perspectiva data keeps polarity, evidence and anchors", () => {
  const data = {
    expert_1: {
      V1: {
        nodes: [
          {
            data: {
              id: "9",
              key: "V1_9",
              label: "Rules",
              participant_type: "expert",
              color: "0",
              history: [{ id: "9", label: "Rules", group: "expert_1" }],
            },
          },
        ],
        edges: [],
      },
      final: {
        nodes: [{ data: { id: "4", key: "V2_4", label: "Regulation", participant_type: "expert", color: "3" } }],
        edges: [
          {
            data: {
              id: "4-4",
              source: "4",
              target: "4",
              polarity: "negative" as const,
              participant_type: "expert",
              group: "expert_1",
              color: "0",
            },
          },
        ],
      },
    },
  };
  const [dataset] = importPerspectiva(data, { expert_1: { "9": "4" } });
  assert.deepEqual(validateDataset(dataset), []);
  assert.deepEqual(dataset.correspondences, [{ from: "V1", to: "final", nodes: { "9": "4" } }]);
  assert.equal(dataset.snapshots[1].edges[0].polarity, "negative");
  assert.deepEqual(dataset.snapshots[0].nodes[0].evidence, [
    { id: "9", text: "Rules", contributor: "expert_1" },
  ]);
});

test("repeated Perspectiva links merge unless their polarity conflicts", () => {
  const link = (polarity: "positive" | "negative") => ({
    data: { id: "1-2", source: "1", target: "2", polarity, participant_type: "expert", group: "g", color: "0" },
  });
  const person = (id: string) => ({
    data: { id, key: `V1_${id}`, label: id, participant_type: "expert", color: "0" },
  });
  const load = (edges: ReturnType<typeof link>[]) =>
    importPerspectiva({ g: { V1: { nodes: [person("1"), person("2")], edges } } })[0];

  const repeated = load([link("positive"), link("positive")]);
  assert.equal(repeated.snapshots[0].edges.length, 1);
  assert.deepEqual(validateDataset(repeated), []);

  const conflicting = load([link("positive"), link("negative")]);
  assert.deepEqual(validateDataset(conflicting), ["V1: duplicate edge 1-2"]);
});

test("Explorer data keeps direction, positions and sentences", () => {
  const dataset = importExplorer({
    nodes: [
      { key: "1", label: "cause", x: 1, y: 2, textContent: [{ item_number: "A1", text: "a sentence" }] },
      { key: "2", label: "effect", x: 3, y: 4, textContent: [] },
    ],
    edges: [["1", "2"]],
  });
  const [{ nodes, edges }] = dataset.snapshots;
  assert.deepEqual(validateDataset(dataset), []);
  assert.deepEqual(nodes[0].position, { x: 1, y: 2 });
  assert.deepEqual(nodes[0].evidence, [{ id: "A1", text: "a sentence" }]);
  assert.equal(edges[0].source, "1");
  assert.equal(edges[0].polarity, undefined);
});

test("an unknown snapshot is named in the error", () => {
  assert.throws(() => diffSnapshots(versions(), "V1", "V2"), /Dataset "d" has no snapshot "V2". It has "V1", "final"/);
  assert.equal(getSnapshot(versions(), "final").id, "final");
});

const merge: CausalDataset = {
  id: "d",
  snapshots: [snapshot("V1", ["a", "b", "c"], [["a", "c"], ["b", "c"]]), snapshot("final", ["ab", "c"], [["ab", "c"]])],
  correspondences: [{ from: "V1", to: "final", nodes: { a: "ab", b: "ab", c: "c" } }],
};

test("a merge read in reverse is a split", () => {
  const diff = diffSnapshots(merge, "final", "V1");
  assert.deepEqual(diff.splitNodes.map(({ from, to }) => [from.id, to.map(({ id }) => id)]), [
    ["ab", ["a", "b"]],
  ]);
  assert.deepEqual(diff.mergedNodes, []);
  assert.deepEqual(diff.addedNodes, []);
  assert.deepEqual(diff.removedNodes, []);
  assert.deepEqual(diff.addedLinks, []);
  assert.deepEqual(diff.removedLinks, []);
});

test("a diff read in reverse mirrors it", () => {
  const ids = (items: { id: string }[]) => items.map(({ id }) => id).sort();
  for (const dataset of [merge, versions({ a: "a", b: "b2", c: "c" }), versions()]) {
    const forward = diffSnapshots(dataset, "V1", "final");
    const backward = diffSnapshots(dataset, "final", "V1");
    assert.deepEqual(ids(forward.addedNodes), ids(backward.removedNodes));
    assert.deepEqual(ids(forward.removedNodes), ids(backward.addedNodes));
    assert.deepEqual(ids(forward.addedLinks), ids(backward.removedLinks));
    assert.deepEqual(ids(forward.removedLinks), ids(backward.addedLinks));
    assert.equal(forward.mergedNodes.length, backward.splitNodes.length);
    assert.equal(forward.splitNodes.length, backward.mergedNodes.length);
    assert.equal(forward.changedLinks.length, backward.changedLinks.length);
  }
});

test("nodes that swap between groups are regrouped", () => {
  const dataset: CausalDataset = {
    id: "d",
    snapshots: [snapshot("V1", ["a", "b"], []), snapshot("final", ["x", "y"], [])],
    correspondences: [
      { from: "V1", to: "final", nodes: { a: "x", b: "y" } },
      { from: "final", to: "V1", nodes: { y: "a" } },
    ],
  };
  const { regroupedNodes, renamedNodes } = diffSnapshots(dataset, "V1", "final");
  assert.deepEqual(regroupedNodes.map(({ from, to }) => [from.map(({ id }) => id), to.map(({ id }) => id)]), [
    [["a", "b"], ["x", "y"]],
  ]);
  assert.deepEqual(renamedNodes, []);
});

test("parallel links between two nodes count once", () => {
  const link = (id: string, polarity: "positive" | "negative") => ({ id, source: "a", target: "b", polarity });
  const dataset = (before: CausalEdge[], after: CausalEdge[]): CausalDataset => ({
    id: "d",
    snapshots: [
      { id: "V1", nodes: [node("a"), node("b")], edges: before },
      { id: "final", nodes: [node("a"), node("b")], edges: after },
    ],
  });

  const same = diffSnapshots(dataset([link("1", "positive"), link("2", "positive")], [link("3", "positive")]), "V1", "final");
  assert.deepEqual([same.addedLinks, same.removedLinks, same.changedLinks], [[], [], []]);

  const mixed = diffSnapshots(dataset([link("1", "positive"), link("2", "negative")], [link("3", "negative")]), "V1", "final");
  assert.deepEqual(mixed.changedLinks.map(({ polarity }) => polarity), [["mixed", "negative"]]);
});

test("change marks put each kind of change on the side that has it", () => {
  const diff = diffSnapshots(versions({ a: "a", b: "b2", c: "c" }), "V1", "final");
  const before = changeMarks(diff, "from");
  const after = changeMarks(diff, "to");
  assert.deepEqual(before.added, []);
  assert.deepEqual(after.removed, []);
  assert.deepEqual(before.removed.sort(), ["a-gone", "gone"]);
  assert.deepEqual(after.added.sort(), ["c-new", "new"]);
  // b was renamed b2, and the link a→b flipped from positive to negative
  assert.deepEqual(before.changed.sort(), ["a-b", "b"]);
  assert.deepEqual(after.changed.sort(), ["a-b2", "b2"]);
  assert.deepEqual(after.flipped, ["a-b2"]);

  const merged = changeMarks(diffSnapshots(merge, "V1", "final"), "from");
  assert.deepEqual(merged.changed.sort(), ["a", "b"]);
  assert.deepEqual(changeMarks(diffSnapshots(merge, "V1", "final"), "to").changed, ["ab"]);
});
