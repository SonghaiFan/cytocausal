/** How the radial menu splits the space around a node by direction. Angles are in radians. */

const TURN = 2 * Math.PI;

/** One linked node's direction: the angles it covers, and its true bearing within them. */
export interface DirectionCell {
  from: number;
  to: number;
  at: number;
}

/**
 * Spreads angles that lie closer than `width`, keeping each as near its true direction as it
 * can. The angles must be sorted.
 */
export function spread(angles: number[], width: number): number[] {
  const placed = [...angles];
  for (let i = 1; i < placed.length; i++) placed[i] = Math.max(placed[i], placed[i - 1] + width);
  // Anything pushed past a full turn wraps into the first, so the whole set shifts back
  const overflow = placed.length > 1 ? placed[placed.length - 1] - (placed[0] + TURN - width) : 0;
  return overflow > 0 ? placed.map((angle, index) => angle - (overflow * index) / (placed.length - 1)) : placed;
}

/**
 * Splits the space around a node among its neighbours by direction: each gets the angles nearer
 * its own bearing than any other's, a Voronoi diagram on the circle. So wherever the pointer is
 * around the node, it picks the node lying most nearly that way.
 *
 * - Bearings closer than `min` are spread apart first, so every cell is at least `min` wide.
 * - No cell reaches more than `reach` from its bearing, so with few neighbours each still shows
 *   which way its node lies, rather than one taking the whole ring.
 *
 * `bearings` must be sorted. `at` is the true bearing, or as near as its cell allows.
 */
export function directionCells(bearings: number[], { min, reach }: { min: number; reach: number }): DirectionCell[] {
  const count = bearings.length;
  if (count === 0) return [];
  const width = Math.min(min, TURN / count);
  const gaps = bearings.map((bearing, index) =>
    index === 0 ? bearing + TURN - bearings[count - 1] : bearing - bearings[index - 1],
  );
  const sites = count > 1 && Math.min(...gaps) < width ? spread(bearings, width) : bearings;
  return sites.map((site, index) => {
    const previous = index === 0 ? sites[count - 1] - TURN : sites[index - 1];
    const next = index === count - 1 ? sites[0] + TURN : sites[index + 1];
    const from = Math.max((previous + site) / 2, site - reach);
    const to = Math.min((site + next) / 2, site + reach);
    // The true bearing, taken the short way round from where the cell ended up
    const offset = ((((bearings[index] - site) % TURN) + TURN + Math.PI) % TURN) - Math.PI;
    return { from, to, at: Math.min(to, Math.max(from, site + offset)) };
  });
}

/** Pick a step from the same measured boundaries that the feedback draws. */
export function distanceStep(distance: number, boundaries: readonly number[]): number {
  const index = boundaries.findIndex(boundary => distance <= boundary);
  return index < 0 ? Math.max(1, boundaries.length) : index + 1;
}

/** Cumulative extent of each causal layer, measured from the menu origin. */
export function directionBoundaries(
  edges: readonly { id: string; source: string; target: string }[],
  origin: string,
  target: string,
  maxDepth: number,
  firstReach: number,
  distanceOf: (id: string) => number,
  padding = 32,
): number[] {
  const boundaries = [firstReach];
  let previous = directionRoute(edges, origin, target, 1);
  for (let step = 2; step <= maxDepth; step++) {
    const route = directionRoute(edges, origin, target, step);
    const added = route.nodes.filter(id => !previous.nodes.includes(id));
    if (!added.length && route.edges.length === previous.edges.length) break;
    // A layer that bends back toward the origin shares the existing boundary.
    // Do not invent a farther radius when the topology has no farther nodes.
    boundaries.push(Math.max(boundaries[boundaries.length - 1], ...added.map(id => distanceOf(id) + padding)));
    previous = route;
  }
  return boundaries;
}

/** Follow the chosen first link, continuing in its causal direction for the remaining steps. */
export function directionRoute(
  edges: readonly { id: string; source: string; target: string }[],
  origin: string,
  target: string,
  steps: number,
): { nodes: string[]; edges: string[] } {
  const nodes = new Set([origin, target]);
  const links = new Set<string>();
  for (const forward of [true, false]) {
    const first = edges.filter(e => forward
      ? e.source === origin && e.target === target
      : e.target === origin && e.source === target);
    if (!first.length) continue;
    first.forEach(e => links.add(e.id));
    let frontier = new Set([target]);
    const visited = new Set([origin, target]);
    for (let depth = 1; depth < steps && frontier.size; depth++) {
      const next = new Set<string>();
      for (const edge of edges) {
        const from = forward ? edge.source : edge.target;
        const to = forward ? edge.target : edge.source;
        if (!frontier.has(from)) continue;
        links.add(edge.id); nodes.add(to);
        if (!visited.has(to)) next.add(to);
      }
      next.forEach(id => visited.add(id));
      frontier = next;
    }
  }
  return { nodes: [...nodes], edges: [...links] };
}
