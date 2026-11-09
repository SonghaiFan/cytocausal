import type { CausalEdge, Snapshot } from "./types.ts";

export interface CausalPath {
  /** Nodes in causal order. */
  nodes: string[];
  edges: string[];
}

export interface PathOptions {
  /** Skip paths with more nodes than this. */
  maxLength?: number;
  /** Stop after this many paths. */
  limit?: number;
}

export interface PathSearch {
  /** Shortest first. */
  paths: CausalPath[];
  /** False if `maxLength` or `limit` may have hidden some paths. */
  complete: boolean;
}

const outgoingLinks = ({ nodes, edges }: Snapshot) => {
  const outgoing = new Map<string, CausalEdge[]>(nodes.map(({ id }) => [id, []]));
  for (const edge of edges) outgoing.get(edge.source)?.push(edge);
  return outgoing;
};

/**
 * Lists the causal paths from one node to another, following link direction. It searches one
 * length at a time, so when `limit` cuts the list short it keeps the shortest paths.
 */
export function findCausalPaths(
  snapshot: Snapshot,
  from: string,
  to: string,
  { maxLength = 8, limit = 50 }: PathOptions = {},
): PathSearch {
  const outgoing = outgoingLinks(snapshot);
  const paths: CausalPath[] = [];
  if (from === to) return { paths, complete: true };

  for (let length = 2; length <= maxLength; length++) {
    // Whether some route went on past this length, so longer paths may exist
    let longer = false;
    const route = [from];
    const routeEdges: string[] = [];
    const onRoute = new Set(route);

    /** Returns true once a path is found past `limit`. */
    const visit = (node: string): boolean => {
      for (const { id, target } of outgoing.get(node) ?? []) {
        if (onRoute.has(target)) continue;
        if (target === to) {
          if (route.length + 1 !== length) continue;
          if (paths.length >= limit) return true;
          paths.push({ nodes: [...route, target], edges: [...routeEdges, id] });
          continue;
        }
        if (route.length + 1 >= length) {
          longer = true;
          continue;
        }
        route.push(target);
        routeEdges.push(id);
        onRoute.add(target);
        if (visit(target)) return true;
        onRoute.delete(target);
        routeEdges.pop();
        route.pop();
      }
      return false;
    };

    if (visit(from)) return { paths, complete: false };
    if (!longer) return { paths, complete: true };
  }

  return { paths, complete: false };
}
