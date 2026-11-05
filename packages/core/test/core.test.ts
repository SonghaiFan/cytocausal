import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSnapshot,
  findFeedbackLoops,
  importExplorer,
  importPerspectiva,
  searchNodes,
  validateDataset,
} from "../src/index.ts";
import type { CausalDataset, Snapshot } from "../src/index.ts";

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
