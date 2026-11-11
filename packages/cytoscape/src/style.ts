import { pillTextSizer } from "./text-size.ts";
import type { Stylesheet } from "cytoscape";
import { mix, textOn, type CausalTheme } from "./theme.ts";

export interface CausalStyleOptions {
  /** `dot` puts the label beside the node, and `pill` holds it inside. */
  node?: "dot" | "pill";
  /** `flowing` bends links apart, which suits small diagrams. `straight` suits dense ones. */
  link?: "bezier" | "flowing" | "straight";
  /** Size nodes by their `score` data, from 0 to 1. */
  sizeByScore?: boolean;
  /** Draw links thicker the more people stated them, from their `supportShare` data. */
  weightBySupport?: boolean;
  /**
   * For labels that are placed by code, as `keepLabelsReadable` does: only nodes with the
   * `labelled` class show one, sized and positioned by their `label…` data. Highlights don't
   * force a label, so the placement decides what fits.
   */
  managedLabels?: boolean;
  /**
   * What zooming does to marks: dots, text, lines, arrows and rings, together.
   * - `magnify` scales them all with the graph, like a photo. It suits a small diagram read whole.
   * - `spread` keeps them a constant size on screen and only moves nodes apart. It suits a dense
   *   network people zoom into to separate crowded nodes.
   * - `balanced` scales them by the square root of the zoom, as Sigma.js does: zooming in 4 times
   *   makes them twice as big.
   * Defaults to `spread` with managed labels, else `magnify`. Managed labels keep their text a
   * constant size in every mode. `spread` and `balanced` need `keepConstantSize`, which
   * `keepLabelsReadable` turns on.
   */
  zoom?: ZoomMode;
  /** App-specific rules. They go before the interaction states, so highlights still win. */
  baseRules?: Stylesheet[];
}

export type ZoomMode = "magnify" | "balanced" | "spread";

/** The zoom mode in effect, given the default for managed labels. */
const zoomMode = ({ zoom, managedLabels }: CausalStyleOptions): ZoomMode =>
  zoom ?? (managedLabels ? "spread" : "magnify");

/** The data field `keepConstantSize` writes for a mode: 1/zoom, or 1/√zoom. */
const FACTOR: Record<ZoomMode, string | null> = {
  magnify: null,
  spread: "zoomScale",
  balanced: "zoomRoot",
};

/** Pills hold small text that's read zoomed in, so spread pills draw it larger to start with. */
const PILL_SPREAD = 11 / 6;

/** A dot's diameter in pixels: by centrality from 5 to 24, or 20. */
const dotSize = (score: unknown, sizeByScore?: boolean) =>
  sizeByScore ? 5 + 19 * Math.min(1, Math.max(0, Number(score) || 0)) : 20;

const nodeStyles = (
  { colors, fontFamily }: CausalTheme,
  options: CausalStyleOptions,
) => {
  const { node = "pill", sizeByScore, managedLabels } = options;
  const mode = zoomMode(options);
  const field = FACTOR[mode];
  const spread = field !== null;
  const stroke = strokeOf(mode);
  if (node === "pill") {
    const pill = (pixels: number) => (spread ? stroke(pixels * PILL_SPREAD) : `${pixels}px`);
    const measure = pillTextSizer(fontFamily);
    const size = (ele: { data: (key: string) => unknown }) => measure(
      String(ele.data("label") ?? ""),
      field ? (Number(ele.data(field)) || 1) * PILL_SPREAD : 1,
    );
    return {
      shape: "round-rectangle",
      width: (ele: { data: (key: string) => unknown }) => size(ele).width,
      height: (ele: { data: (key: string) => unknown }) => size(ele).height,
      padding: pill(5),
      "background-color": colors.node,
      "border-color": colors.background,
      "border-width": spread ? stroke(1) : "1px",
      color: colors.nodeText,
      label: "data(label)",
      "text-wrap": "wrap",
      "text-max-width": pill(50),
      "text-valign": "center",
      "text-halign": "center",
      "font-size": pill(6),
      // Text too small to see only costs time to draw, so Cytoscape skips it below this. Pill
      // text is small to begin with, so the bar is low enough to keep it in a narrow window
      "min-zoomed-font-size": 3,
    };
  }
  // Dots combine two data fields, which a mapper can't, so a function sizes them
  const size = field
    ? (ele: { data: (key: string) => unknown }) =>
        dotSize(ele.data("score"), sizeByScore) * (Number(ele.data(field)) || 1)
    : sizeByScore
      ? "mapData(score, 0, 1, 5, 24)"
      : 20;
  return {
    width: size,
    height: size,
    // A pale dot would vanish against the page, so dots take the link grey
    "background-color": colors.link,
    color: colors.text,
    // Keeps labels readable where they cross a link
    "text-outline-color": colors.background,
    "text-outline-width": stroke(2),
    ...(managedLabels
      ? {
          "font-size": "data(labelSize)",
          "text-max-width": "data(labelWidth)",
          "text-wrap": "wrap",
        }
      : {
          label: "data(label)",
          "font-size": stroke(12),
          "text-margin-y": field ? `mapData(${field}, 0, ${ZOOM_RANGE}, 0, ${-4 * ZOOM_RANGE})` : -4,
          "min-zoomed-font-size": 6,
        }),
  };
};

/**
 * Mappings stop at their ends, so they cover a factor up to 4: zooming out to a quarter for
 * `spread`, or to a sixteenth for `balanced`.
 */
const ZOOM_RANGE = 4;

/**
 * A line width in screen pixels when labels are managed, which also keeps text a constant size,
 * so links don't swell as people zoom in. `keepLabelsReadable` writes the `zoomScale` data.
 */
function strokeOf(mode: ZoomMode) {
  const field = FACTOR[mode];
  return (pixels: number) =>
    field ? `mapData(${field}, 0, ${ZOOM_RANGE}, 0, ${pixels * ZOOM_RANGE})` : pixels;
}

/**
 * How Cytoscape sizes an arrowhead, from its renderer: a triangle `0.3 × size` long and wide, where
 * `size = max((width × 13.37) ^ 0.9, 29) × arrow-scale`. Below a width of about 3, the arrow
 * ignores the line and depends on `arrow-scale` alone. Cytoscape's own default, a 3 px line with
 * scale 1, gives an 8.7 px arrow, about three times the line.
 */
export const arrowLength = (width: number, scale: number) =>
  0.3 * Math.max((width * 13.37) ** 0.9, 29) * scale;

/** The `arrow-scale` that draws an arrow this many pixels long on a thin line. */
const scaleForArrow = (pixels: number) => pixels / (0.3 * 29);

/**
 * Arrow size in pixels, kept constant on screen with managed labels. A thin line alone doesn't
 * keep the arrow small, because Cytoscape gives arrows a minimum size.
 */
const arrowOf =
  (mode: ZoomMode) =>
  (pixels: number) => {
    const scale = Number(scaleForArrow(pixels).toFixed(3));
    const field = FACTOR[mode];
    // Cytoscape rejects an arrow scale of 0, even as the start of a mapping, so it starts above
    return field ? `mapData(${field}, 0, ${ZOOM_RANGE}, 0.001, ${scale * ZOOM_RANGE})` : scale;
  };

/** How strongly a receding link shows, as if it were drawn at this opacity. */
const RECEDING = 0.35;

const linkStyles = (
  { colors }: CausalTheme,
  options: CausalStyleOptions,
) => {
  const { link = "flowing", weightBySupport } = options;
  const mode = zoomMode(options);
  const stroke = strokeOf(mode);
  const arrow = arrowOf(mode);
  const field = FACTOR[mode];
  // Support and zoom are two data fields, which a mapper can't combine, so a function does
  const weight = weightBySupport
    ? {
        width: field
          ? (ele: { data: (key: string) => unknown }) =>
              (1.5 + 5.5 * (Number(ele.data("supportShare")) || 0)) * (Number(ele.data(field)) || 1)
          : "mapData(supportShare, 0, 1, 1.5, 7)",
      }
    : {};
  const shared = {
    "line-color": colors.link,
    "target-arrow-color": colors.link,
    "target-arrow-shape": "triangle",
    color: colors.text,
  };
  if (link === "straight") {
    // Dense graphs need their links to recede until a highlight brings them forward. A pale
    // opaque colour does that without transparency, which makes Cytoscape draw every arrow
    // twice and darkens wherever links cross
    const receding = mix(colors.link, colors.background, RECEDING);
    return {
      ...shared,
      "line-color": receding,
      "target-arrow-color": receding,
      width: stroke(1),
      // Six pixels, about Cytoscape's own ratio of arrow to line
      "arrow-scale": arrow(6),
      "curve-style": "straight",
      ...weight,
    };
  }
  const labelled = {
    ...shared,
    width: stroke(2),
    label: "data(label)",
    "text-outline-color": colors.background,
    "text-outline-width": field ? stroke(1) : "1px",
    ...weight,
  };
  return link === "flowing"
    ? {
        ...labelled,
        "curve-style": "unbundled-bezier",
        "arrow-scale": arrow(7),
        // One bend, bowing further on longer links, from `curveLinks`. Links running each way
        // between two nodes bow to opposite sides, where a symmetric S-curve would overlap
        "control-point-distances": "data(arc)",
        "control-point-weights": 0.5,
      }
    : { ...labelled, "curve-style": "bezier" };
};

/** Builds a Cytoscape stylesheet with every state the framework's interactions use. */
export function createCausalStyle(theme: CausalTheme, options: CausalStyleOptions = {}) {
  const { colors, dimmedOpacity, fontFamily } = theme;
  const { node = "pill", link = "flowing" } = options;
  // Labels inside a node need to stay readable when a highlight recolours it
  const onColour = (color: string) => (node === "pill" ? { color: textOn(color) } : {});
  const highlight = (color: string) => ({
    "line-color": color,
    "target-arrow-color": color,
    opacity: 1,
    "z-index": 9,
  });
  // Managed labels are placed by `keepLabelsReadable`, which writes where each one goes
  const shownLabel = options.managedLabels
    ? {
        label: "data(label)",
        "text-outline-width": "data(labelOutline)",
        "text-halign": "data(labelHalign)",
        "text-valign": "data(labelValign)",
        "text-margin-x": "data(labelMarginX)",
        "text-margin-y": "data(labelMarginY)",
        "line-height": 1.2,
      }
    : {};
  // Highlights never change a link's width: width shows quantities, such as support
  const stroke = strokeOf(zoomMode(options));
  // A neighbour is brought forward by contrast alone. A pill just keeps full contrast while the
  // rest fades. A dot, too small for that to show, darkens to ink
  const linked = node === "pill" ? {} : { "background-color": colors.ink };
  // Fades what didn't change less than a selection fades its context, so the graph stays legible
  const changeContextOpacity = Math.min(1, dimmedOpacity * 2.5);

  return [
    { selector: "node", style: { "font-family": fontFamily, ...nodeStyles(theme, options) } },
    { selector: "edge", style: { "font-family": fontFamily, ...linkStyles(theme, options) } },
    {
      selector: 'edge[polarity="negative"]',
      style: { "line-style": "dashed" },
    },
    ...(options.baseRules ?? []),
    // The marking sunburst supplies press feedback; suppress Cytoscape's
    // default grey rounded rectangle while a node is held.
    { selector: "node:active", style: { "overlay-opacity": 0 } },
    { selector: "node.labelled", style: shownLabel },
    { selector: ".dimmed", style: { opacity: dimmedOpacity } },
    // Dimmed links fade from their full colour, as they did before receding links became pale
    ...(link === "straight"
      ? [{ selector: "edge.dimmed", style: { "line-color": colors.link, "target-arrow-color": colors.link } }]
      : []),
    { selector: ".outside-loops", style: { display: "none" } },
    { selector: ".contributor-hidden", style: { display: "none" } },
    // Changes between versions: what stayed the same fades, as context does for a selection.
    // Added and removed parts take their own hues, and changed ones keep full contrast
    { selector: ".diff-context", style: { opacity: changeContextOpacity } },
    {
      selector: "node.diff-added",
      style: { ...onColour(colors.added), "background-color": colors.added },
    },
    {
      selector: "node.diff-removed",
      style: { ...onColour(colors.removed), "background-color": colors.removed },
    },
    { selector: "edge.diff-added", style: highlight(colors.added) },
    { selector: "edge.diff-removed", style: highlight(colors.removed) },
    { selector: "edge.diff-changed", style: highlight(colors.ink) },
    // A flipped link shows ± as well as its new line style
    { selector: "edge.diff-flipped", style: { label: "±", "font-weight": "bold" } },
    // Focus and context come last, because what the reader chose matters more than what
    // changed. The accent is only ever a fill: chosen nodes take it, and their links keep full
    // contrast in ink, so no warm line can be mistaken for a removed one. The rest fades
    {
      selector: "node.focus, node.route-node",
      style: { ...onColour(colors.accent), "background-color": colors.accent, "z-index": 10 },
    },
    { selector: "node.cause, node.effect", style: { ...linked, "z-index": 9 } },
    {
      selector: "edge.cause-link, edge.effect-link, edge.route-link",
      style: highlight(colors.ink),
    },
    // A selection wins over the fading of what didn't change
    {
      selector: [".focus", ".cause", ".effect", ".route-node", ".cause-link", ".effect-link", ".route-link"]
        .map((state) => `.diff-context${state}`)
        .join(", "),
      style: { opacity: 1 },
    },
    { selector: ".diff-context.dimmed", style: { opacity: dimmedOpacity } },
    {
      selector: "node.keyboard-cursor",
      style: { "outline-width": stroke(3), "outline-color": colors.ink, "outline-offset": stroke(3) },
    },
    // The node a long press locked the radial menu on: a border, as asked for, in ink
    {
      selector: "node.menu-held",
      style: { "border-width": stroke(2), "border-color": colors.ink },
    },
  ] as unknown as Stylesheet[];
}
