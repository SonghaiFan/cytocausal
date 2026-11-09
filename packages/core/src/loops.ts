import type { CausalEdge, Snapshot } from "./types.ts";

export type LoopType = "reinforcing" | "balancing" | "unknown";

export interface FeedbackLoop {
  /** Nodes in causal order. The last links back to the first. */
  nodes: string[];
  edges: string[];
  type: LoopType;
}

export interface LoopOptions {
  /** Only find loops through this node. */
  through?: string;
  /** Skip loops with more nodes than this. Set it for large graphs, as the search can be slow. */
  maxLength?: number;
  /** Stop after this many loops. */
  limit?: number;
}

export interface LoopSearch {
  /** Shortest first. */
  loops: FeedbackLoop[];
  /** False if `maxLength` or `limit` may have hidden some loops. */
  complete: boolean;
}

/** An even number of negative links reinforces change, and an odd number balances it. */
function classify(edges: CausalEdge[]): LoopType {
  if (edges.some(({ polarity }) => !polarity)) return "unknown";
  const negative = edges.filter(({ polarity }) => polarity === "negative").length;
  return negative % 2 === 0 ? "reinforcing" : "balancing";
}

/**
 * Lists the simple cycles of a snapshot, each once, and classifies them from link polarity. It
 * searches one length at a time, so when `limit` cuts the list short it keeps the shortest loops.
 */
export function findFeedbackLoops(
  { nodes, edges }: Snapshot,
  { through, maxLength = Infinity, limit = 1000 }: LoopOptions = {},
): LoopSearch {
  const outgoing = new Map<string, CausalEdge[]>(nodes.map(({ id }) => [id, []]));
  for (const edge of edges) outgoing.get(edge.source)?.push(edge);

  // Each loop is found once: from its earliest node, or from `through`
  const order = new Map(nodes.map(({ id }, index) => [id, index]));
  const starts = through ? [through] : nodes.map(({ id }) => id);
  const loops: FeedbackLoop[] = [];

  for (let length = 1; length <= maxLength; length++) {
    // Whether some path went on past this length, so longer loops may exist
    let longer = false;

    for (const start of starts) {
      const path = [start];
      const pathEdges: CausalEdge[] = [];
      const onPath = new Set(path);

      /** Returns true once a loop is found past `limit`. */
      const visit = (node: string): boolean => {
        for (const edge of outgoing.get(node) ?? []) {
          const next = edge.target;
          if (next === start) {
            if (path.length !== length) continue;
            if (loops.length >= limit) return true;
            const route = [...pathEdges, edge];
            loops.push({ nodes: [...path], edges: route.map(({ id }) => id), type: classify(route) });
            continue;
          }
          if (onPath.has(next) || (!through && order.get(next)! < order.get(start)!)) continue;
          if (path.length >= length) {
            longer = true;
            continue;
          }
          path.push(next);
          pathEdges.push(edge);
          onPath.add(next);
          if (visit(next)) return true;
          onPath.delete(next);
          pathEdges.pop();
          path.pop();
        }
        return false;
      };

      if (visit(start)) return { loops, complete: false };
    }

    if (!longer) return { loops, complete: true };
  }

  return { loops, complete: false };
}
