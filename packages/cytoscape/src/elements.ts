import type { Snapshot } from "@cytocausal/core";
import type { ElementDefinition } from "cytoscape";

const polarityLabel = { positive: "+", negative: "-" };

/** Converts a snapshot to Cytoscape elements, with metadata available to style selectors. */
export function toElements({ nodes, edges }: Snapshot) {
  return {
    nodes: nodes.map(
      ({ id, label, position, metadata }): ElementDefinition => ({
        data: { ...metadata, id, label },
        position,
      }),
    ),
    edges: edges.map(
      ({ id, source, target, polarity, metadata }): ElementDefinition => ({
        data: {
          ...metadata,
          id,
          source,
          target,
          polarity,
          label: polarity ? polarityLabel[polarity] : "",
        },
      }),
    ),
  };
}
