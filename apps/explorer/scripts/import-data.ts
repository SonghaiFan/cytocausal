// Regenerates Explorer's data from a checkout of the original Causal Explorer project.
//
//   CYTOCAUSAL_EXPLORER=/path/to/causal_explorer npm run import-data
//     writes the public sample to public/dataset.json
//
//   CYTOCAUSAL_EXPLORER=/path/to/causal_explorer npm run import-data -- --full
//     writes the full graph to public/dataset.full.json, which Git ignores. Don't publish it:
//     ACCESS offers the full benchmark on request. To view it, run the app with
//     NEXT_PUBLIC_EXPLORER_DATA=/dataset.full.json
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeSnapshot, importExplorer, validateDataset, type Snapshot } from "@cytocausal/core";

const source = process.env.CYTOCAUSAL_EXPLORER;
if (!source) throw new Error("Set CYTOCAUSAL_EXPLORER to the Causal Explorer project folder");

const full = process.argv.includes("--full");

// Fits a screen at around normal zoom, so that nodes stay visible in the overview
const LAYOUT_WIDTH = 1000;
const SAMPLE_NODES = 100;
const SAMPLE_EVENTS = 5;

/** Keeps the most central events and the links between them, with a few descriptions each. */
function sample({ id, nodes, edges }: Snapshot): Snapshot {
  const { betweenness } = analyzeSnapshot({ id, nodes, edges });
  const kept = new Set(
    [...nodes]
      .sort((a, b) => betweenness[b.id] - betweenness[a.id])
      .slice(0, SAMPLE_NODES)
      .map((node) => node.id),
  );
  const keptEdges = edges.filter(({ source, target }) => kept.has(source) && kept.has(target));
  const linked = new Set(keptEdges.flatMap(({ source, target }) => [source, target]));
  return {
    id,
    nodes: nodes
      .filter((node) => linked.has(node.id))
      .map((node) => ({ ...node, evidence: node.evidence?.slice(0, SAMPLE_EVENTS) })),
    edges: keptEdges,
  };
}

const imported = importExplorer(
  JSON.parse(readFileSync(path.join(source, "public/dataset.json"), "utf8")),
  full ? "access" : "access-sample",
);
const issues = validateDataset(imported);
if (issues.length > 0) throw new Error(issues.join("\n"));

const snapshot = full ? imported.snapshots[0] : sample(imported.snapshots[0]);

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

const file = full ? "dataset.full.json" : "dataset.json";
const output = path.resolve(import.meta.dirname, "../public", file);
writeFileSync(output, `${JSON.stringify({ ...imported, snapshots: [snapshot] })}\n`);
console.log(`Wrote ${snapshot.nodes.length} nodes to public/${file}`);
