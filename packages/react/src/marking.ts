import { menuTarget, type MenuArea, type MenuSector } from "./overlay.ts";

export interface MarkingLevel { area: MenuArea; chosen: MenuSector | null }
export interface MarkingState { levels: MarkingLevel[] }

/** Lock a traversed fan, then interpret angles around its chosen node. */
export function moveMarking(
  state: MarkingState,
  pointer: { x: number; y: number },
  maxDepth: number,
  areaFor: (node: string, visited: string[]) => MenuArea,
): MarkingState {
  const levels = state.levels.map(level => ({ ...level }));
  // Return toward the preceding centre to back out; crossing a parent's radial
  // boundary sideways while steering around the child must not switch branches.
  while (levels.length > 1) {
    const parent = levels[levels.length - 2];
    const current = levels[levels.length - 1];
    const parentDistance = Math.hypot(pointer.x - parent.area.x, pointer.y - parent.area.y);
    const childDistance = Math.hypot(pointer.x - current.area.x, pointer.y - current.area.y);
    if (parentDistance >= parent.chosen!.reach - 24 || parentDistance >= childDistance) break;
    levels.pop();
  }
  let current = levels[levels.length - 1];
  const target = menuTarget(current.area, pointer, true);
  current.chosen = current.area.sectors?.find(s => s.node === target) ?? null;
  if (current.chosen && levels.length < maxDepth &&
      Math.hypot(pointer.x - current.area.x, pointer.y - current.area.y) > current.chosen.reach) {
    const child = areaFor(current.chosen.node, levels.map(level => level.area.node));
    if (child.sectors?.length) {
      current = { area: child, chosen: null };
      levels.push(current);
      const childTarget = menuTarget(child, pointer, true);
      current.chosen = child.sectors.find(s => s.node === childTarget) ?? null;
    }
  }
  return { levels };
}

export function markingRoute(state: MarkingState) {
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const { area, chosen } of state.levels) {
    nodes.add(area.node);
    if (chosen) {
      nodes.add(chosen.node);
      chosen.links.forEach(id => edges.add(id));
    }
  }
  return { nodes: [...nodes], edges: [...edges] };
}
