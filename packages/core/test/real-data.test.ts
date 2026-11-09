import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzeSnapshot,
  diffSnapshots,
  findFeedbackLoops,
  importExplorer,
  importPerspectiva,
  validateDataset,
} from "../src/index.ts";

// The real datasets stay outside this repo. These tests run when they are on disk.
const projects = path.resolve(import.meta.dirname, "../../../../causal");
const perspectiva =
  process.env.CYTOCAUSAL_PERSPECTIVA ?? path.join(projects, "perspectiva-causal-loop-diagram");
const explorer = process.env.CYTOCAUSAL_EXPLORER ?? path.join(projects, "causal_explorer");

const explorerFile = path.join(explorer, "public/dataset.json");
const perspectivaFiles = ["new_data.js", "nodeAnchors.js"].map((file) =>
  path.join(perspectiva, "src/data", file),
);

/** Reads the object from a file holding one `const` or `export const` declaration. */
const evaluate = (file: string, name: string) => {
  const source = readFileSync(file, "utf8")
    .replace(/export\s*\{[^}]*\};?/, "")
    .replace(/^export const/m, "const");
  return new Function(`${source};return ${name};`)();
};

test(
  "Perspectiva imports with every anchor intact",
  { skip: !perspectivaFiles.every(existsSync) },
  () => {
    const datasets = importPerspectiva(
      evaluate(perspectivaFiles[0], "allCyDataSets"),
      evaluate(perspectivaFiles[1], "nodeAnchors"),
    );
    assert.equal(datasets.length, 8);
    assert.deepEqual(datasets.flatMap(validateDataset), []);
    const anchors = datasets.flatMap((dataset) =>
      dataset.correspondences!.flatMap(({ nodes }) => Object.keys(nodes)),
    );
    assert.equal(anchors.length, 129);

    // Counts match NetworkX's simple_cycles on every snapshot
    const searches = datasets.flatMap(({ snapshots }) => snapshots.map((s) => findFeedbackLoops(s)));
    const loops = searches.flatMap((search) => search.loops);
    assert.ok(searches.every((search) => search.complete));
    assert.equal(loops.length, 89);
    assert.equal(loops.filter(({ type }) => type === "reinforcing").length, 59);
    assert.equal(loops.filter(({ type }) => type === "balancing").length, 30);
  },
);

test("Explorer imports and matches the known analysis", { skip: !existsSync(explorerFile) }, () => {
  const dataset = importExplorer(JSON.parse(readFileSync(explorerFile, "utf8")));
  assert.deepEqual(validateDataset(dataset), []);

  const [graph] = dataset.snapshots;
  assert.equal(graph.nodes.length, 725);
  assert.equal(graph.edges.length, 1494);

  const { betweenness, feedbackGroups } = analyzeSnapshot(graph);
  assert.equal(feedbackGroups[0].length, 213);
  assert.equal(feedbackGroups.length, 1);
  assert.equal(Object.values(betweenness).filter((score) => score === 0).length, 400);

  // Counts match NetworkX's simple_cycles with the same length bound
  const { loops, complete } = findFeedbackLoops(graph, { maxLength: 6, limit: Infinity });
  assert.equal(loops.length, 463);
  assert.equal(complete, false);
  assert.ok(loops.every(({ type }) => type === "unknown"));
});

test(
  "Perspectiva's versions differ by the counts worked out separately from the source data",
  { skip: !perspectivaFiles.every(existsSync) },
  () => {
    const datasets = importPerspectiva(
      evaluate(perspectivaFiles[0], "allCyDataSets"),
      evaluate(perspectivaFiles[1], "nodeAnchors"),
    );
    const counts = Object.fromEntries(
      datasets.map((dataset) => {
        const diff = diffSnapshots(dataset, "V1", "final");
        return [
          dataset.id,
          [
            diff.addedNodes.length,
            diff.removedNodes.length,
            diff.renamedNodes.length,
            diff.mergedNodes.length,
            diff.addedLinks.length,
            diff.removedLinks.length,
            diff.changedLinks.length,
          ],
        ];
      }),
    );
    assert.deepEqual(counts, {
      advocate_7: [10, 1, 9, 1, 12, 2, 0],
      citizen_1: [3, 0, 13, 0, 7, 2, 1],
      expert_2: [8, 2, 12, 0, 22, 14, 2],
      citizen_3: [7, 1, 13, 2, 18, 9, 1],
      citizen_4: [4, 0, 10, 0, 13, 6, 1],
      citizen_5: [2, 1, 10, 1, 6, 6, 1],
      advocate_6: [10, 2, 9, 0, 17, 6, 0],
      expert_9: [10, 2, 9, 1, 22, 11, 1],
    });
  },
);
