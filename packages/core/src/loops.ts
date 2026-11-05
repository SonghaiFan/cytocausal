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

/** Lists the simple cycles of a snapshot, each once, and classifies them from link polarity. */
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
  let complete = true;

  for (const start of starts) {
    const path = [start];
    const pathEdges: CausalEdge[] = [];
    const onPath = new Set(path);

    const visit = (node: string) => {
      for (const edge of outgoing.get(node) ?? []) {
        if (loops.length >= limit) {
          complete = false;
          return;
        }
        const next = edge.target;
        if (next === start) {
          const route = [...pathEdges, edge];
          loops.push({ nodes: [...path], edges: route.map(({ id }) => id), type: classify(route) });
          continue;
        }
        if (onPath.has(next) || (!through && order.get(next)! < order.get(start)!)) continue;
        if (path.length >= maxLength) {
          complete = false;
          continue;
        }
        path.push(next);
        pathEdges.push(edge);
        onPath.add(next);
        visit(next);
        onPath.delete(next);
        pathEdges.pop();
        path.pop();
      }
    };

    visit(start);
  }

  loops.sort((a, b) => a.nodes.length - b.nodes.length);
  return { loops, complete };
}
