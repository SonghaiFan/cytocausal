import { createCausalStyle, type CausalStyleOptions, type CausalTheme } from "@cytocausal/cytoscape";
import type { LegendItem } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";

/**
 * What each annotation in the source data means, and how it's drawn. Annotations are the
 * workshop's own categories, less important than what the reader is looking at or what changed,
 * so they get the channels nothing else uses: a node's outline style, and a glyph on a link.
 * Hue, contrast and width are left to selection, changes and support.
 */
export const annotations = [
  { index: "1", label: "Added in the workshop", mark: "ring", glyph: "*" },
  { index: "2", label: "Needs clarification", mark: "dotted", glyph: "?" },
  { index: "3", label: "Conflict", mark: undefined, glyph: "!" },
] as const;

/** Legend entries for the annotations, in the theme's ink. */
export const annotationLegend: LegendItem[] = annotations.map(({ label, mark, glyph }) => ({
  label,
  color: "var(--cc-ink)",
  mark,
  glyph,
}));

/** A link's polarity sign, followed by its annotation's glyph. */
const withGlyph = (glyph: string) => (ele: { data: (key: string) => unknown }) =>
  `${String(ele.data("label") ?? "")} ${glyph}`.trim();

/** The framework's default style, with the workshop's annotations added. */
export function graphStyles(theme: CausalTheme, options: CausalStyleOptions = {}) {
  const { ink } = theme.colors;
  const rules = annotations.flatMap(({ index, mark, glyph }) => [
    ...(mark
      ? [
          {
            selector: `node[color = "${index}"]`,
            style: {
              "border-width": 2,
              "border-color": ink,
              "border-style": mark === "ring" ? "solid" : mark,
            },
          },
        ]
      : []),
    { selector: `edge[color = "${index}"]`, style: { label: withGlyph(glyph) } },
  ]) as unknown as Stylesheet[];
  return createCausalStyle(theme, { ...options, baseRules: rules });
}
