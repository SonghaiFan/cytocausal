import type { Stylesheet } from "cytoscape";
import type { CausalTheme } from "./theme.ts";

export interface CausalStyleOptions {
  /** `dot` puts the label beside the node, and `pill` holds it inside. */
  node?: "dot" | "pill";
  /** `flowing` bends links apart, which suits small diagrams. `straight` suits dense ones. */
  link?: "bezier" | "flowing" | "straight";
  /** Size nodes by their `score` data, from 0 to 1. */
  sizeByScore?: boolean;
  /**
   * For labels that are placed by code: only nodes with the `labelled` class show one, sized
   * by their `labelSize` and `labelWidth` data.
   */
  managedLabels?: boolean;
  /** App-specific rules. They go before the interaction states, so highlights still win. */
  baseRules?: Stylesheet[];
}

const nodeStyles = (
  { colors }: CausalTheme,
  { node = "pill", sizeByScore, managedLabels }: CausalStyleOptions,
) => {
  if (node === "pill") {
    return {
      shape: "round-rectangle",
      width: "label",
      height: "label",
      padding: "5px",
      "background-color": colors.node,
      "border-color": colors.background,
      "border-width": "1px",
      color: colors.nodeText,
      label: "data(label)",
      "text-wrap": "wrap",
      "text-max-width": "50px",
      "text-valign": "center",
      "text-halign": "center",
      "font-size": "6px",
    };
  }
  const size = sizeByScore ? "mapData(score, 0, 1, 5, 24)" : 20;
  return {
    width: size,
    height: size,
    "background-color": colors.node,
    color: colors.text,
    // Keeps labels readable where they cross a link
    "text-outline-color": colors.background,
    "text-outline-width": 2,
    ...(managedLabels
      ? {
          "font-size": "data(labelSize)",
          "text-max-width": "data(labelWidth)",
          "text-wrap": "wrap",
        }
      : { label: "data(label)", "font-size": 12, "text-margin-y": -4 }),
  };
};

const linkStyles = ({ colors }: CausalTheme, { link = "flowing" }: CausalStyleOptions) => {
  const shared = {
    "line-color": colors.link,
    "target-arrow-color": colors.link,
    "target-arrow-shape": "triangle",
    color: colors.text,
  };
  if (link === "straight") {
    return { ...shared, width: 1, "arrow-scale": 0.6, "curve-style": "straight" };
  }
  const labelled = {
    ...shared,
    width: 2,
    label: "data(label)",
    "text-outline-color": colors.background,
    "text-outline-width": "1px",
  };
  return link === "flowing"
    ? {
        ...labelled,
        "curve-style": "unbundled-bezier",
        "arrow-scale": 0.8,
        "control-point-distances": [-20, 20],
        "control-point-weights": [0.5],
      }
    : { ...labelled, "curve-style": "bezier" };
};

/** Builds a Cytoscape stylesheet with every state the framework's interactions use. */
export function createCausalStyle(theme: CausalTheme, options: CausalStyleOptions = {}) {
  const { colors, dimmedOpacity, fontFamily } = theme;
  const { node = "pill", link = "flowing" } = options;
  // Labels inside a node need to stay readable when a highlight recolours it
  const onColour = node === "pill" ? { color: colors.background } : {};
  const highlight = (color: string) => ({
    "line-color": color,
    "target-arrow-color": color,
    "z-index": 9,
  });
  const shownLabel = options.managedLabels ? { label: "data(label)" } : {};

  return [
    { selector: "node", style: { "font-family": fontFamily, ...nodeStyles(theme, options) } },
    { selector: "edge", style: { "font-family": fontFamily, ...linkStyles(theme, options) } },
    {
      selector: 'edge[polarity="negative"]',
      style: {
        "line-style": "dashed",
        ...(link === "flowing" ? { "control-point-distances": [20, -20] } : {}),
      },
    },
    ...(options.baseRules ?? []),
    { selector: "node.labelled", style: shownLabel },
    { selector: ".dimmed", style: { opacity: dimmedOpacity } },
    { selector: "node.selected", style: { "border-color": colors.focus, "border-width": "2px" } },
    {
      selector: "node.focus",
      style: {
        ...shownLabel,
        "border-width": node === "pill" ? 2 : 3,
        "border-color": colors.focus,
        "z-index": 10,
      },
    },
    {
      selector: "node.cause",
      style: { ...shownLabel, ...onColour, "background-color": colors.cause, "z-index": 9 },
    },
    {
      selector: "node.effect",
      style: { ...shownLabel, ...onColour, "background-color": colors.effect, "z-index": 9 },
    },
    { selector: "edge.cause-link", style: { ...highlight(colors.cause), width: 2 } },
    { selector: "edge.effect-link", style: { ...highlight(colors.effect), width: 2 } },
    {
      selector: "node.route-node",
      style: { ...shownLabel, "border-width": 2, "border-color": colors.focus, "z-index": 9 },
    },
    { selector: "edge.route-link", style: { ...highlight(colors.focus), width: 3 } },
    { selector: ".outside-loops", style: { display: "none" } },
    { selector: "node.diff-added", style: { ...onColour, "background-color": colors.added } },
    {
      selector: "node.diff-removed",
      style: { ...onColour, "background-color": colors.clarification },
    },
    { selector: "edge.diff-added", style: { ...highlight(colors.added), width: 3 } },
    { selector: "edge.diff-removed", style: { ...highlight(colors.clarification), width: 3 } },
    {
      selector: "node.keyboard-cursor",
      style: { "outline-width": 3, "outline-color": colors.focus, "outline-offset": 3 },
    },
  ] as unknown as Stylesheet[];
}
