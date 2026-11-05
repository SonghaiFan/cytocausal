// Regenerates public/dataset.json from a checkout of the original Causal Explorer project.
//   CYTOCAUSAL_EXPLORER=/path/to/causal_explorer npm run import-data
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeSnapshot, importExplorer, validateDataset } from "@cytocausal/core";

const source = process.env.CYTOCAUSAL_EXPLORER;
if (!source) throw new Error("Set CYTOCAUSAL_EXPLORER to the Causal Explorer project folder");

// The source layout spans about four units. This fits a screen at around normal zoom,
// so that nodes stay visible in the overview.
const LAYOUT_SCALE = 250;

const dataset = importExplorer(
  JSON.parse(readFileSync(path.join(source, "public/dataset.json"), "utf8")),
);
const issues = validateDataset(dataset);
if (issues.length > 0) throw new Error(issues.join("\n"));

// Analysis is done here so that page load only has to draw the graph
const [snapshot] = dataset.snapshots;
const { betweenness, feedbackGroups } = analyzeSnapshot(snapshot);
const highest = Math.max(...Object.values(betweenness));
const inLoops = new Set(feedbackGroups.flat());

for (const node of snapshot.nodes) {
  node.position = { x: node.position!.x * LAYOUT_SCALE, y: node.position!.y * LAYOUT_SCALE };
  node.metadata = { score: betweenness[node.id] / highest, inFeedbackLoop: inLoops.has(node.id) };
}

const output = path.resolve(import.meta.dirname, "../public/dataset.json");
writeFileSync(output, `${JSON.stringify(dataset)}\n`);
console.log(`Wrote ${snapshot.nodes.length} nodes to public/dataset.json`);
