import type { Stylesheet } from "cytoscape";

export const graphStyles = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "background-color": "#fbbf24",
      width: 20,
      height: 20,
      "font-size": 12,
      "text-valign": "top",
      "text-margin-y": -4,
    },
  },
  {
    selector: "edge",
    style: {
      width: 2,
      "line-color": "#9ca3af",
      "target-arrow-color": "#9ca3af",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      label: "data(label)",
    },
  },
  { selector: 'edge[polarity="negative"]', style: { "line-style": "dashed" } },
  { selector: ".dimmed", style: { opacity: 0.2 } },
  { selector: "node.focus", style: { "border-width": 3, "border-color": "#111" } },
  { selector: "node.cause", style: { "background-color": "#d95f02" } },
  { selector: "node.effect", style: { "background-color": "#1b9e77" } },
  { selector: "edge.cause-link", style: { "line-color": "#d95f02", "target-arrow-color": "#d95f02" } },
  { selector: "edge.effect-link", style: { "line-color": "#1b9e77", "target-arrow-color": "#1b9e77" } },
  { selector: "node.loop-node", style: { "border-width": 2, "border-color": "#111" } },
  { selector: "edge.loop-link", style: { "line-color": "#111", "target-arrow-color": "#111" } },
] as unknown as Stylesheet[];
