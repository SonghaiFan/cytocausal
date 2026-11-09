import type { Core, NodeSingular } from "cytoscape";

const FONT_SIZE = 12;
const LINE_HEIGHT = 1.2;
const OUTLINE = 2;
/** Space between a node and its label, and around each label. */
const GAP = 3;
// At least the outline, which Cytoscape counts as part of the label
const MARGIN = OUTLINE + 1;
const MAX_WIDTH = 160;
const MAX_LABELS = 60;
const SETTLE_MS = 120;
const SCRATCH_KEY = "cytocausal-labels";

type Rect = { left: number; right: number; top: number; bottom: number };
type Side = "top" | "bottom" | "right" | "left";

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const inside = (rect: Rect, area: Rect) =>
  rect.left >= area.left && rect.right <= area.right && rect.top >= area.top && rect.bottom <= area.bottom;

/** Measures text in the browser, or estimates it where there's no canvas, such as in tests. */
function textMeasurer(fontFamily: string) {
  const context =
    typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (context) context.font = `${FONT_SIZE}px ${fontFamily}`;
  const cache = new Map<string, number>();
  return (text: string) => {
    if (!cache.has(text)) {
      cache.set(text, context ? context.measureText(text).width : text.length * FONT_SIZE * 0.6);
    }
    return cache.get(text)!;
  };
}

/** Wraps a label at spaces the way Cytoscape does, and returns the size of the block. */
function labelSize(text: string, measure: (text: string) => number) {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure(`${last} ${word}`) <= MAX_WIDTH) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const width = Math.min(MAX_WIDTH, Math.max(0, ...lines.map(measure)));
  return { width, height: Math.max(1, lines.length) * FONT_SIZE * LINE_HEIGHT };
}

/** Where a label would sit on each side of a node, in screen pixels. */
function candidate(side: Side, x: number, y: number, radius: number, width: number, height: number): Rect {
  const away = radius + GAP;
  const box = (left: number, top: number) => ({
    left: left - MARGIN,
    right: left + width + MARGIN,
    top: top - MARGIN,
    bottom: top + height + MARGIN,
  });
  if (side === "top") return box(x - width / 2, y - away - height);
  if (side === "bottom") return box(x - width / 2, y + away);
  if (side === "right") return box(x + away, y - height / 2);
  return box(x - away - width, y - height / 2);
}

const SIDES: Side[] = ["top", "bottom", "right", "left"];
const ALIGN: Record<Side, { halign: string; valign: string; x: number; y: number }> = {
  top: { halign: "center", valign: "top", x: 0, y: -1 },
  bottom: { halign: "center", valign: "bottom", x: 0, y: 1 },
  right: { halign: "right", valign: "center", x: 1, y: 0 },
  left: { halign: "left", valign: "center", x: -1, y: 0 },
};

/**
 * Which nodes deserve a label first. What a person is looking at comes before centrality: the
 * keyboard cursor and selected nodes, then a highlighted route, then causes and effects.
 */
function rank(node: NodeSingular) {
  if (node.hasClass("keyboard-cursor") || node.hasClass("focus")) return 3;
  if (node.hasClass("route-node")) return 2;
  if (node.hasClass("cause") || node.hasClass("effect")) return 1;
  return 0;
}

/** A coarse grid of screen rectangles, so each check only looks at nearby ones. */
function spatialIndex(cell = 64) {
  const cells = new Map<string, Rect[]>();
  const keys = ({ left, right, top, bottom }: Rect) => {
    const found: string[] = [];
    for (let i = Math.floor(left / cell); i <= Math.floor(right / cell); i++) {
      for (let j = Math.floor(top / cell); j <= Math.floor(bottom / cell); j++) found.push(`${i}:${j}`);
    }
    return found;
  };
  return {
    add(rect: Rect) {
      for (const key of keys(rect)) {
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(rect);
      }
    },
    hits(rect: Rect, except?: Rect) {
      return keys(rect).some((key) =>
        (cells.get(key) ?? []).some((other) => other !== except && overlaps(rect, other)),
      );
    },
  };
}

/** Where each visible node sits on screen, as a box around its dot. */
function nodeDiscs(cy: Core) {
  const index = spatialIndex();
  const discs = new Map<string, Rect>();
  cy.nodes(":visible").forEach((node) => {
    const { x, y } = node.renderedPosition();
    const radius = node.renderedWidth() / 2;
    const disc = { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius };
    discs.set(node.id(), disc);
    index.add(disc);
  });
  return { index, discs };
}

/** Allows a pixel of rounding, so labels that only touch a dot still count as clear. */
const shrink = ({ left, right, top, bottom }: Rect, by: number) => ({
  left: left + by,
  right: right - by,
  top: top + by,
  bottom: bottom - by,
});

export interface LabelPlacement {
  id: string;
  side: Side;
}

/**
 * Chooses which nodes get a label, and on which side, so that no label covers another label or
 * another node. Nodes are taken in order of `rank` and then `score`. While anything is
 * highlighted, dimmed nodes get no label, so the highlight reads clearly.
 */
export function placeLabels(cy: Core, measure: (text: string) => number): LabelPlacement[] {
  const screen = { left: 0, right: cy.width(), top: 0, bottom: cy.height() };
  const shown = cy.nodes(":visible").toArray() as NodeSingular[];
  const highlighting = shown.some((node) => node.hasClass("dimmed"));
  const candidates = shown
    .filter((node) => !highlighting || !node.hasClass("dimmed"))
    .sort((a, b) => rank(b) - rank(a) || (b.data("score") ?? 0) - (a.data("score") ?? 0));

  // Every visible node is an obstacle, so a label never sits on top of a dot
  const { index: nodes, discs } = nodeDiscs(cy);

  const labels = spatialIndex();
  const placements: LabelPlacement[] = [];
  for (const node of candidates) {
    const important = rank(node) >= 2;
    if (placements.length >= MAX_LABELS && !important) break;
    const { x, y } = node.renderedPosition();
    const radius = node.renderedWidth() / 2;
    const { width, height } = labelSize(String(node.data("label") ?? ""), measure);
    const own = discs.get(node.id());
    const fits = (side: Side) => {
      const rect = candidate(side, x, y, radius, width, height);
      return inside(rect, screen) && !labels.hits(rect) && !nodes.hits(rect, own) ? rect : null;
    };
    let side = SIDES.find(fits);
    // What someone chose to look at keeps its label, even where nothing is free
    if (!side && important && overlaps(candidate("top", x, y, radius, width, height), screen)) side = "top";
    if (!side) continue;
    labels.add(candidate(side, x, y, radius, width, height));
    placements.push({ id: node.id(), side });
  }
  return placements;
}

/**
 * Labels the nodes that matter most on screen without any label covering another label or a
 * node. Text, outlines and gaps are sized to stay constant as the zoom changes. Labels update
 * once zooming or panning stops, because restyling every frame is slow, and again whenever a
 * highlight changes.
 */
export function keepLabelsReadable(cy: Core) {
  const fontFamily = String(cy.nodes().first().style("font-family") || "sans-serif");
  const measure = textMeasurer(fontFamily);

  const update = () => {
    if (cy.destroyed()) return;
    const placements = placeLabels(cy, measure);
    const zoom = cy.zoom();
    cy.batch(() => {
      cy.nodes().removeClass("labelled").data({
        labelSize: FONT_SIZE / zoom,
        labelWidth: MAX_WIDTH / zoom,
        labelOutline: OUTLINE / zoom,
      });
      // Links are styled from this, so they stay as thin on screen as they were drawn
      cy.edges().data({ zoomScale: 1 / zoom });
      for (const { id, side } of placements) {
        const { halign, valign, x, y } = ALIGN[side];
        cy.getElementById(id)
          .addClass("labelled")
          .data({
            labelHalign: halign,
            labelValign: valign,
            labelMarginX: (x * GAP) / zoom,
            labelMarginY: (y * GAP) / zoom,
          });
      }
    });

    // Wrapping can differ slightly from the estimate, so check the labels as Cytoscape drew
    // them, and drop a less important one that clashes
    const drawn = spatialIndex();
    const { index: dots, discs } = nodeDiscs(cy);
    for (const { id } of placements) {
      const node = cy.getElementById(id);
      const box = node.renderedBoundingBox({ includeNodes: false, includeEdges: false, includeOverlays: false });
      const rect = { left: box.x1, right: box.x2, top: box.y1, bottom: box.y2 };
      const clashes = drawn.hits(rect) || dots.hits(shrink(rect, 1), discs.get(id));
      if (clashes && rank(node) < 2) node.removeClass("labelled");
      else drawn.add(rect);
    }
  };

  let timer: ReturnType<typeof setTimeout>;
  cy.on("viewport", () => {
    clearTimeout(timer);
    timer = setTimeout(update, SETTLE_MS);
  });
  cy.on("resize", update);

  // Highlights can change several times in one interaction, so they share one update. A timer
  // rather than an animation frame keeps it working in a background tab
  let pending = false;
  cy.scratch(SCRATCH_KEY, () => {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      update();
    }, 0);
  });
  update();
}

/** Places labels again after a highlight changes. Does nothing unless labels are managed. */
export function refreshLabels(cy: Core) {
  const refresh = cy.scratch(SCRATCH_KEY) as (() => void) | undefined;
  refresh?.();
}
