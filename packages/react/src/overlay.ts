import type { Core } from "cytoscape";

/** The circle a radial menu covers, in page coordinates, and the node it belongs to. */
export interface MenuArea {
  x: number;
  y: number;
  radius: number;
  node: string;
}

const KEY = "cytocausal-radial-area";

/** Records where the radial menu is, so tooltips can keep out of its way. */
export const setMenuArea = (cy: Core, area: MenuArea | null) => {
  if (!cy.destroyed()) cy.scratch(KEY, area);
};

export const menuArea = (cy: Core | null): MenuArea | null =>
  cy && !cy.destroyed() ? ((cy.scratch(KEY) as MenuArea | undefined) ?? null) : null;

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
