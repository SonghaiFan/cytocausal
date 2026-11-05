import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSnapshot, importExplorer, importPerspectiva, validateDataset } from "../src/index.ts";
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
