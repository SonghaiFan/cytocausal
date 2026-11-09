import {
  createCausalStyle,
  textOn,
  type CausalStyleOptions,
  type CausalTheme,
} from "@cytocausal/cytoscape";
import type { Stylesheet } from "cytoscape";

/** What each annotation in the source data means, and the theme colour that shows it. */
export const annotations = [
  { index: "2", label: "Needs clarification", color: "clarification" },
  { index: "3", label: "Conflict", color: "conflict" },
  { index: "1", label: "Added", color: "added" },
] as const;

// Pale yellow fills a node well, but a thin line of it disappears on white
const linkColor = (theme: CausalTheme, color: (typeof annotations)[number]["color"]) =>
  color === "clarification" ? theme.colors.node : theme.colors[color];

/** The framework's default style, with the workshop's annotations added. */
export function graphStyles(theme: CausalTheme, options: CausalStyleOptions = {}) {
  const rules = annotations.flatMap(({ index, color }) => [
    {
      selector: `node[color = "${index}"]`,
      style: { "background-color": theme.colors[color], color: textOn(theme.colors[color]) },
    },
    {
      selector: `edge[color="${index}"]`,
      style: { "line-color": linkColor(theme, color), "target-arrow-color": linkColor(theme, color) },
    },
  ]) as unknown as Stylesheet[];
  return createCausalStyle(theme, { ...options, baseRules: rules });
}
