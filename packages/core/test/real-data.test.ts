import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { analyzeSnapshot, importExplorer, importPerspectiva, validateDataset } from "../src/index.ts";

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
});
