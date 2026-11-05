import type { Stylesheet } from "cytoscape";

export const colorSchema = [
  { index: "2", label: "Relationship needs clarification", color: "#e97451" },
  { index: "3", label: "Conflict with other participants", color: "#2a79ef" },
  { index: "1", label: "Added", color: "#809b88" },
];

export const graphStyles = [
  {
    selector: "node",
    style: {
      shape: "round-rectangle",
      width: "label",
      height: "label",
      padding: "5px",
      "background-color": "#fbbf24",
      "border-color": "#f8fafc",
      "border-width": "1px",
      label: "data(label)",
      "text-wrap": "wrap",
      "text-max-width": "50px",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "6px",
    },
  },
  { selector: "node.selected", style: { "border-color": "#000", "border-width": "2px" } },
  ...colorSchema.map(({ index, color }) => ({
    selector: `node[color = "${index}"]`,
    style: { "background-color": color },
  })),
  {
    selector: "edge",
    style: {
      width: 2,
      "curve-style": "unbundled-bezier",
      "line-color": "#d9dadc",
      "target-arrow-color": "#d9dadc",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      "control-point-distances": [-20, 20],
      "control-point-weights": [0.5],
      label: "data(label)",
      "text-outline-color": "#fff",
      "text-outline-width": "1px",
    },
  },
  ...colorSchema.map(({ index, color }) => ({
    selector: `edge[color="${index}"]`,
    style: { "line-color": color, "target-arrow-color": color },
  })),
  {
    selector: 'edge[polarity="negative"]',
    style: {
      "line-style": "dashed",
      "control-point-distances": [20, -20],
      "control-point-weights": [0.5],
    },
  },
] as unknown as Stylesheet[];
