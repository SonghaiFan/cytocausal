import cytoscape from "cytoscape";
import type { Snapshot } from "./types.ts";

export interface SnapshotAnalysis {
  /** Normalised directed betweenness centrality per node. */
  betweenness: Record<string, number>;
  /** Sets of nodes that can all reach each other, largest first. Each contains a feedback loop. */
  feedbackGroups: string[][];
}

/** Analyses a snapshot along causal direction, using headless Cytoscape. */
export function analyzeSnapshot({ nodes, edges }: Snapshot): SnapshotAnalysis {
  const cy = cytoscape({
    headless: true,
    elements: [
      ...nodes.map(({ id }) => ({ data: { id } })),
      // Two sources can state the same link, so edge ids are not reused here
      ...edges.map(({ source, target }, index) => ({
        data: { id: `edge-${index}`, source, target },
      })),
    ],
  });

  const centrality = cy.elements().betweennessCentrality({ directed: true });
  const { components } = cy.elements().tarjanStronglyConnected();

  return {
    betweenness: Object.fromEntries(
      cy.nodes().map((node) => [node.id(), centrality.betweennessNormalized(node)]),
    ),
    feedbackGroups: components
      .map((component) => component.nodes().map((node) => node.id()))
      .filter((group) => group.length > 1)
      .sort((a, b) => b.length - a.length),
  };
}
