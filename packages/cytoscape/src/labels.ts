import type { Core, NodeSingular } from "cytoscape";

const FONT_SIZE = 12;
const LINE_HEIGHT = 15;
const CHARACTER_WIDTH = FONT_SIZE * 0.62;
const MARGIN = 4;
const MAX_WIDTH = 160;
const MAX_LABELS = 60;
const SETTLE_MS = 120;

type Rect = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Estimates where a node's label sits on screen, above the node. */
function labelRect(node: NodeSingular): Rect {
  const { x, y } = node.renderedPosition();
  const textWidth = String(node.data("label")).length * CHARACTER_WIDTH;
  const width = Math.min(textWidth, MAX_WIDTH);
  const height = Math.ceil(textWidth / MAX_WIDTH) * LINE_HEIGHT;
  const top = y - node.renderedHeight() / 2 - height;
  return {
    left: x - width / 2 - MARGIN,
    right: x + width / 2 + MARGIN,
    top: top - MARGIN,
    bottom: top + height + MARGIN,
  };
}

/**
 * Labels the most central nodes on screen, skipping any label that would overlap one
 * already placed. Cytoscape scales text with zoom, so sizes are set to stay constant.
 * Labels update once zooming or panning stops, because restyling every frame is slow.
 */
export function keepLabelsReadable(cy: Core) {
  const update = () => {
    if (cy.destroyed()) return;
    const placed: Rect[] = [];
    const screen = { left: 0, right: cy.width(), top: 0, bottom: cy.height() };
    const ranked = cy
      .nodes(":visible")
      .toArray()
      .sort((a, b) => b.data("score") - a.data("score")) as NodeSingular[];
    const labelled = ranked.filter((node) => {
      if (placed.length >= MAX_LABELS) return false;
      const rect = labelRect(node);
      if (!overlaps(rect, screen) || placed.some((other) => overlaps(rect, other))) return false;
      placed.push(rect);
      return true;
    });

    const zoom = cy.zoom();
    cy.batch(() => {
      cy.nodes().data({ labelSize: FONT_SIZE / zoom, labelWidth: MAX_WIDTH / zoom });
      cy.nodes().removeClass("labelled");
      labelled.forEach((node) => node.addClass("labelled"));
    });

    // Text wrapping can't be estimated exactly, so check the labels as Cytoscape drew them
    const drawn: { x1: number; x2: number; y1: number; y2: number }[] = [];
    for (const node of labelled) {
      const box = node.boundingBox({
        includeNodes: false,
        includeEdges: false,
        includeOverlays: false,
      });
      const clashes = drawn.some(
        (other) =>
          box.x1 < other.x2 && other.x1 < box.x2 && box.y1 < other.y2 && other.y1 < box.y2,
      );
      if (clashes) node.removeClass("labelled");
      else drawn.push(box);
    }
  };

  let timer: ReturnType<typeof setTimeout>;
  cy.on("viewport", () => {
    clearTimeout(timer);
    timer = setTimeout(update, SETTLE_MS);
  });
  update();
}
