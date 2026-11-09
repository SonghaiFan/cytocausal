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

/** Lists the causal paths from one node to another, following link direction. */
export function findCausalPaths(
  snapshot: Snapshot,
  from: string,
  to: string,
  { maxLength = 8, limit = 50 }: PathOptions = {},
): PathSearch {
  const outgoing = outgoingLinks(snapshot);
  const paths: CausalPath[] = [];
  let complete = true;
  const route = [from];
  const routeEdges: string[] = [];
  const onRoute = new Set(route);

  const visit = (node: string) => {
    for (const { id, target } of outgoing.get(node) ?? []) {
      if (paths.length >= limit) {
        complete = false;
        return;
      }
      if (onRoute.has(target)) continue;
      if (route.length >= maxLength) {
        complete = false;
        continue;
      }
      route.push(target);
      routeEdges.push(id);
      onRoute.add(target);
      if (target === to) paths.push({ nodes: [...route], edges: [...routeEdges] });
      else visit(target);
      onRoute.delete(target);
      routeEdges.pop();
      route.pop();
    }
  };

  if (from !== to) visit(from);
  paths.sort((a, b) => a.nodes.length - b.nodes.length);
  return { paths, complete };
}
