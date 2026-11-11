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
