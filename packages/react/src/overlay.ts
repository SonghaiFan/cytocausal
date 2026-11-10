import type { Core, EdgeSingular, NodeSingular } from "cytoscape";

/**
 * One linked node's direction around the menu: the angles nearest it, in radians, out to just
 * past the node, in pixels from the menu's centre.
 */
export interface MenuSector {
  node: string;
  /** The links between the selected node and this one, which lead there too. */
  links: string[];
  from: number;
  to: number;
  reach: number;
}

/** The circle a radial menu covers, in page coordinates, and the node it belongs to. */
export interface MenuArea {
  x: number;
  y: number;
  radius: number;
  node: string;
  /** Where the directions toward linked nodes start: the edge of the selected node. */
  inner?: number;
  /** Each linked node's direction, unseen, out from the node toward it. */
  sectors?: MenuSector[];
}

const KEY = "cytocausal-radial-area";

/** Records where the radial menu is, so tooltips can keep out of its way. */
export const setMenuArea = (cy: Core, area: MenuArea | null) => {
  if (!cy.destroyed()) cy.scratch(KEY, area);
};

export const menuArea = (cy: Core | null): MenuArea | null =>
  cy && !cy.destroyed() ? ((cy.scratch(KEY) as MenuArea | undefined) ?? null) : null;

/**
 * The linked node whose direction a point on the graph lies in, off the selected node and short
 * of the linked one, or null. The empty graph around a selected node is split this way, so it
 * needs no visible target for each link.
 */
export function menuTarget(area: MenuArea | null, pointer: { x: number; y: number }, unbounded = false): string | null {
  if (!area?.sectors) return null;
  const [dx, dy] = [pointer.x - area.x, pointer.y - area.y];
  const distance = Math.hypot(dx, dy);
  if (distance <= (area.inner ?? area.radius)) return null;
  const angle = Math.atan2(dy, dx);
  const turn = 2 * Math.PI;
  const sector = area.sectors.find(({ from, to, reach }) => {
    if (!unbounded && distance > reach) return false;
    // Taken from the start of the sector, the short way round
    const along = (((angle - from) % turn) + turn) % turn;
    return along <= to - from;
  });
  return sector?.node ?? null;
}

/**
 * The linked node an element on the graph leads to around the menu: the node itself, or a link
 * between it and the selected node. These are the natural things to point at to go that way, so
 * they count as part of their direction. Other nodes and links keep their own hover and click.
 */
export function menuTargetOf(area: MenuArea | null, element: { node?: string; link?: string }): string | null {
  const sector = area?.sectors?.find(
    ({ node, links }) => (element.node !== undefined && node === element.node) || (element.link !== undefined && links.includes(element.link)),
  );
  return sector?.node ?? null;
}

/** What pointing at a spot on the graph means while the radial menu is open. */
export interface MenuPointing {
  /** The linked node it leads to, if any. */
  leadsTo: string | null;
  /** Whether the spot is backdrop: empty graph, or anything faded. */
  backdrop: boolean;
}

/**
 * What pointing here means while the radial menu is open. The menu works like a modal: what's
 * faded behind it is backdrop, so it can't be chosen until the menu closes.
 *
 * - Every graph element except the selected node is backdrop, even when bright.
 * - Backdrop leads to the fan under the pointer, or closes the menu outside all fans.
 * - Clicking the selected node closes it. Highlight styling never changes hit rules.
 *
 * Without an open menu, or while tracing paths, when another node must be chosen, nothing is
 * backdrop. `point` is in rendered coordinates. The menu's centre is measured afresh, so a tap
 * straight after the view moves still lines up.
 */
export function menuPointing(
  cy: Core,
  target: Core | NodeSingular | EdgeSingular,
  point: { x: number; y: number },
): MenuPointing {
  const area = menuArea(cy);
  if (!area?.sectors) return { leadsTo: null, backdrop: false };
  // The selected node is the menu's close target. Every other graph element
  // belongs to its backdrop, regardless of the current highlight or preview.
  const element = target !== cy ? target as NodeSingular | EdgeSingular : null;
  if (element?.isNode() && element.id() === area.node) {
    return { leadsTo: null, backdrop: false };
  }
  const node = cy.getElementById(area.node);
  if (node.length === 0) return { leadsTo: null, backdrop: true };
  const centre = node.renderedPosition();
  const leadsTo = menuTarget(
    { ...area, x: centre.x, y: centre.y },
    point,
  );
  return { leadsTo, backdrop: true };
}

export type TooltipPlacement = "above" | "below" | "left" | "right";

/** Roughly how much room a tooltip takes, to test whether it would cover the menu. */
const ROOM = { width: 260, height: 140, gap: 24 };

/**
 * Where a tooltip goes beside the pointer: above it, unless that would cover the radial menu,
 * in which case it goes to the side facing away from the menu. Returns null where the menu has
 * the job instead: over the selected node, or inside the menu's circle. One floating layer at a
 * time.
 */
export function tooltipPlacement(
  area: MenuArea | null,
  pointer: { x: number; y: number },
  node?: string,
): TooltipPlacement | null {
  if (!area) return "above";
  if (node === area.node) return null;
  const [dx, dy] = [pointer.x - area.x, pointer.y - area.y];
  if (Math.hypot(dx, dy) <= area.radius) return null;

  // Would a tooltip above the pointer reach into the menu's circle?
  const box = {
    left: pointer.x - ROOM.width / 2,
    right: pointer.x + ROOM.width / 2,
    top: pointer.y - ROOM.gap - ROOM.height,
    bottom: pointer.y - ROOM.gap,
  };
  const nearestX = Math.max(box.left, Math.min(area.x, box.right));
  const nearestY = Math.max(box.top, Math.min(area.y, box.bottom));
  if (Math.hypot(area.x - nearestX, area.y - nearestY) > area.radius) return "above";

  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "above" : "below";
}

/** The CSS transform that puts a tooltip on that side of the pointer. */
export const placementTransform: Record<TooltipPlacement, string> = {
  above: `translate(-50%, calc(-100% - ${ROOM.gap}px))`,
  below: `translate(-50%, ${ROOM.gap}px)`,
  left: `translate(calc(-100% - ${ROOM.gap}px), -50%)`,
  right: `translate(${ROOM.gap}px, -50%)`,
};
