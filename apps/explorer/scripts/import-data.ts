// Regenerates Explorer's data from a checkout of the original Causal Explorer project.
//
//   CYTOCAUSAL_EXPLORER=/path/to/causal_explorer npm run import-data
//     writes the full graph to public/dataset.json
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeSnapshot, importExplorer, validateDataset } from "@cytocausal/core";

const source = process.env.CYTOCAUSAL_EXPLORER;
if (!source) throw new Error("Set CYTOCAUSAL_EXPLORER to the Causal Explorer project folder");

// Fits a screen at around normal zoom, so that nodes stay visible in the overview
const LAYOUT_WIDTH = 1000;

const imported = importExplorer(
  JSON.parse(readFileSync(path.join(source, "public/dataset.json"), "utf8")),
  "access",
);
const issues = validateDataset(imported);
if (issues.length > 0) throw new Error(issues.join("\n"));

const snapshot = imported.snapshots[0];

// Analysis is done here so that page load only has to draw the graph
const { betweenness, feedbackGroups } = analyzeSnapshot(snapshot);
const highest = Math.max(...Object.values(betweenness));
const inLoops = new Set(feedbackGroups.flat());

const xs = snapshot.nodes.map((node) => node.position!.x);
const ys = snapshot.nodes.map((node) => node.position!.y);
const scale =
  LAYOUT_WIDTH / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

for (const node of snapshot.nodes) {
  node.position = { x: node.position!.x * scale, y: node.position!.y * scale };
  node.metadata = { score: betweenness[node.id] / highest, inFeedbackLoop: inLoops.has(node.id) };
}

const output = path.resolve(import.meta.dirname, "../public/dataset.json");
writeFileSync(output, `${JSON.stringify({ ...imported, snapshots: [snapshot] })}\n`);
console.log(`Wrote ${snapshot.nodes.length} nodes to public/dataset.json`);
