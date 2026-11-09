import type { Snapshot } from "./types.ts";

/** Each node's distinct successors, in snapshot order. Links to missing nodes are skipped. */
function successors({ nodes, edges }: Snapshot) {
  const next = new Map<string, Set<string>>(nodes.map(({ id }) => [id, new Set()]));
  for (const { source, target } of edges) {
    if (next.has(target)) next.get(source)?.add(target);
  }
  return new Map([...next].map(([id, targets]) => [id, [...targets]]));
}

/**
 * Directed betweenness centrality, by Brandes' algorithm. Parallel links count once and links
 * from a node to itself are ignored, as in Cytoscape's `betweennessCentrality`.
 */
export function betweennessCentrality(snapshot: Snapshot): Record<string, number> {
  const next = successors(snapshot);
  const ids = snapshot.nodes.map(({ id }) => id);
  const score = new Map(ids.map((id) => [id, 0]));

  for (const source of ids) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(ids.map((id) => [id, []]));
    const paths = new Map(ids.map((id) => [id, 0]));
    const distance = new Map(ids.map((id) => [id, Infinity]));
    paths.set(source, 1);
    distance.set(source, 0);

    const queue = [source];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      stack.push(node);
      for (const target of next.get(node)!) {
        if (distance.get(target) === Infinity) {
          distance.set(target, distance.get(node)! + 1);
          queue.push(target);
        }
        if (distance.get(target) === distance.get(node)! + 1) {
          paths.set(target, paths.get(target)! + paths.get(node)!);
          predecessors.get(target)!.push(node);
        }
      }
    }

    const dependency = new Map(ids.map((id) => [id, 0]));
    while (stack.length > 0) {
      const node = stack.pop()!;
      for (const previous of predecessors.get(node)!) {
        const share = (paths.get(previous)! / paths.get(node)!) * (1 + dependency.get(node)!);
        dependency.set(previous, dependency.get(previous)! + share);
      }
      if (node !== source) score.set(node, score.get(node)! + dependency.get(node)!);
    }
  }

  return Object.fromEntries(score);
}

/** Scales scores so the highest is 1, or leaves them all 0. */
export function normalizeScores(scores: Record<string, number>): Record<string, number> {
  const highest = Math.max(0, ...Object.values(scores));
  return Object.fromEntries(
    Object.entries(scores).map(([id, value]) => [id, highest === 0 ? 0 : value / highest]),
  );
}

/**
 * Sets of nodes that can all reach each other, by Tarjan's algorithm. It doesn't recurse, so
 * long chains can't overflow the stack. Nodes keep their snapshot order.
 */
export function stronglyConnectedComponents(snapshot: Snapshot): string[][] {
  const next = successors(snapshot);
  const order = new Map(snapshot.nodes.map(({ id }, index) => [id, index]));
  const index = new Map<string, number>();
  const lowest = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let counter = 0;

  for (const { id: root } of snapshot.nodes) {
    if (index.has(root)) continue;
    // Each frame is a node and how many of its successors have been visited
    const frames: [string, number][] = [[root, 0]];
    index.set(root, counter);
    lowest.set(root, counter++);
    stack.push(root);
    onStack.add(root);

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      const [node, position] = frame;
      const targets = next.get(node)!;

      if (position < targets.length) {
        frame[1]++;
        const target = targets[position];
        if (!index.has(target)) {
          index.set(target, counter);
          lowest.set(target, counter++);
          stack.push(target);
          onStack.add(target);
          frames.push([target, 0]);
        } else if (onStack.has(target)) {
          lowest.set(node, Math.min(lowest.get(node)!, index.get(target)!));
        }
        continue;
      }

      frames.pop();
      if (frames.length > 0) {
        const parent = frames[frames.length - 1][0];
        lowest.set(parent, Math.min(lowest.get(parent)!, lowest.get(node)!));
      }
      if (lowest.get(node) === index.get(node)) {
        const component: string[] = [];
        let member: string;
        do {
          member = stack.pop()!;
          onStack.delete(member);
          component.push(member);
        } while (member !== node);
        components.push(component.sort((a, b) => order.get(a)! - order.get(b)!));
      }
    }
  }

  return components;
}
