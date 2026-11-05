import type { Stylesheet } from "cytoscape";

export const CAUSE_COLOR = "#d95f02";
export const EFFECT_COLOR = "#1b9e77";

export const graphStyles = [
  {
    selector: "node",
    style: {
      width: "mapData(score, 0, 1, 5, 24)",
      height: "mapData(score, 0, 1, 5, 24)",
      "background-color": "#1f77b4",
      "font-size": "data(labelSize)",
      "text-max-width": "data(labelWidth)",
      "text-wrap": "wrap",
    },
  },
  {
    selector: "node.labelled, node.focus, node.cause, node.effect",
    style: { label: "data(label)" },
  },
  {
    selector: "edge",
    style: {
      width: 1,
      "line-color": "#ccc",
      "target-arrow-color": "#ccc",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.6,
      "curve-style": "straight",
    },
  },
  { selector: ".dimmed", style: { opacity: 0.12 } },
  { selector: ".outside-loops", style: { display: "none" } },
  {
    selector: "node.focus",
    style: { "border-width": 3, "border-color": "#111", "z-index": 10 },
  },
  {
    selector: "node.cause",
    style: { "background-color": CAUSE_COLOR, "z-index": 9 },
  },
  {
    selector: "node.effect",
    style: { "background-color": EFFECT_COLOR, "z-index": 9 },
  },
  {
    selector: "edge.cause-link",
    style: { width: 2, "line-color": CAUSE_COLOR, "target-arrow-color": CAUSE_COLOR },
  },
  {
    selector: "edge.effect-link",
    style: { width: 2, "line-color": EFFECT_COLOR, "target-arrow-color": EFFECT_COLOR },
  },
] as unknown as Stylesheet[];
