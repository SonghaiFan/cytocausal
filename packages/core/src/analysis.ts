import { betweennessCentrality, normalizeScores, stronglyConnectedComponents } from "./graph.ts";
import type { Snapshot } from "./types.ts";

export interface SnapshotAnalysis {
  /** Directed betweenness centrality per node, scaled so the highest is 1. */
  betweenness: Record<string, number>;
  /** Sets of nodes that can all reach each other, largest first. Each contains a feedback loop. */
  feedbackGroups: string[][];
}

/** Analyses a snapshot along causal direction. */
export function analyzeSnapshot(snapshot: Snapshot): SnapshotAnalysis {
  const order = new Map(snapshot.nodes.map(({ id }, index) => [id, index]));
  return {
    betweenness: normalizeScores(betweennessCentrality(snapshot)),
    feedbackGroups: stronglyConnectedComponents(snapshot)
      .filter((group) => group.length > 1)
      // Largest first, then in snapshot order, so the result doesn't depend on search order
      .sort((a, b) => b.length - a.length || order.get(a[0])! - order.get(b[0])!),
  };
}
