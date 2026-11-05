import type { CausalDataset } from "../types.ts";

export interface ExplorerData {
  nodes: {
    key: string;
    label: string;
    x: number;
    y: number;
    textContent: { item_number: string; text: string }[];
  }[];
  edges: [string, string][];
}

/** Converts Causal Explorer's `dataset.json` into a dataset with one snapshot. */
export function importExplorer(data: ExplorerData, id = "explorer"): CausalDataset {
  return {
    id,
    snapshots: [
      {
        id: "final",
        nodes: data.nodes.map(({ key, label, x, y, textContent }) => ({
          id: key,
          label,
          position: { x, y },
          evidence: textContent.map(({ item_number, text }) => ({ id: item_number, text })),
        })),
        edges: data.edges.map(([source, target]) => ({
          id: `${source}->${target}`,
          source,
          target,
        })),
      },
    ],
  };
}
