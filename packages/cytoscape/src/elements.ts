import { supportOf, type Snapshot } from "@cytocausal/core";
import type { ElementDefinition } from "cytoscape";

const polarityLabel = { positive: "+", negative: "-" };

/**
 * Support from 0, for one person or none, to 1 for the most supported element, for style
 * mappings. When nobody shares a claim, everything is 0, so nothing looks emphasised.
 */
const shareOf = (support: number, highest: number) =>
  highest > 1 ? Math.max(0, support - 1) / (highest - 1) : 0;

/**
 * Converts a snapshot to Cytoscape elements, with metadata available to style selectors. Each
 * element also gets `support`, the number of people who stated it, and `supportShare`, from 0
 * for one person to 1 for the most supported node or link.
 */
export function toElements({ nodes, edges }: Snapshot) {
  const nodeSupport = nodes.map(supportOf);
  const linkSupport = edges.map(supportOf);
  const mostNodeSupport = Math.max(0, ...nodeSupport);
  const mostLinkSupport = Math.max(0, ...linkSupport);
  return {
    nodes: nodes.map(
      ({ id, label, position, metadata }, index): ElementDefinition => ({
        data: {
          ...metadata,
          id,
          label,
          support: nodeSupport[index],
          supportShare: shareOf(nodeSupport[index], mostNodeSupport),
        },
        position,
      }),
    ),
    edges: edges.map(
      ({ id, source, target, polarity, metadata }, index): ElementDefinition => ({
        data: {
          ...metadata,
          id,
          source,
          target,
          polarity,
          label: polarity ? polarityLabel[polarity] : "",
          support: linkSupport[index],
          supportShare: shareOf(linkSupport[index], mostLinkSupport),
          // A gentle bend until `curveLinks` sizes it from where the nodes end up
          arc: 20,
        },
      }),
    ),
  };
}
