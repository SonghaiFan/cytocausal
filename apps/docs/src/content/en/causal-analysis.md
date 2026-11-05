---
title: "Causal analysis"
---

# Causal analysis

In a causal graph, direction is the meaning of an edge. "Rain causes wet ground" isn't the same as the reverse, so analysis has to follow edge direction. `analyzeSnapshot` in `@cytocausal/core` does that, using Cytoscape without a browser:

```ts
import { analyzeSnapshot, type Snapshot } from "@cytocausal/core";

const snapshot: Snapshot = {
  id: "demo",
  nodes: ["a", "b", "c"].map((id) => ({ id, label: id })),
  edges: [
    { id: "a-b", source: "a", target: "b" },
    { id: "b-c", source: "b", target: "c" },
    { id: "c-b", source: "c", target: "b" },
  ],
};

const { betweenness, feedbackGroups } = analyzeSnapshot(snapshot);
console.log(feedbackGroups); // [["b", "c"]] in either order
console.log(betweenness);
```

Run it in a script or on a server. Explorer does this when its data is imported, so page load only has to draw the graph.

## Directed centrality

Betweenness centrality finds nodes that sit on many shortest paths. Ignoring direction counts paths that causes can't actually travel along.

Causal Explorer's original node sizes ignored direction. Recalculating them along edge direction changed the picture:

| Measure | Undirected | Directed |
| :--- | :--- | :--- |
| Nodes with a score of 0 | 247 | 400 |
| Top 20 nodes shared | 20 | 13 |

The rank correlation between the two scores was 0.74, so they're related but not interchangeable. Pass `directed: true` to `betweennessCentrality`, which `analyzeSnapshot` does for you.

## Feedback loops

A causal network with feedback isn't a chain of causes. `feedbackGroups` lists strongly connected components with more than one node: sets of nodes that can all reach each other, so each set contains at least one loop. It uses Cytoscape's `tarjanStronglyConnected`.

Explorer's network has one such group with 213 of its 725 nodes, about 29% of the graph, and matches the result from NetworkX. The app can isolate it with "Show only feedback loops".

A group tells you loops exist, but not what each loop is or how it behaves. For that, list the loops themselves.

## Individual loops

`findFeedbackLoops` lists each loop once, shortest first, and classifies it from link polarity:

```ts
import { findFeedbackLoops, type Snapshot } from "@cytocausal/core";

const snapshot: Snapshot = {
  id: "demo",
  nodes: [
    { id: "trust", label: "Trust" },
    { id: "use", label: "Use" },
  ],
  edges: [
    { id: "trust-use", source: "trust", target: "use", polarity: "positive" },
    { id: "use-trust", source: "use", target: "trust", polarity: "negative" },
  ],
};

const { loops, complete } = findFeedbackLoops(snapshot);
console.log(loops[0].nodes); // ["trust", "use"]
console.log(loops[0].type); // "balancing"
console.log(complete); // true
```

| Negative links | Type | Behaviour |
| :--- | :--- | :--- |
| An even number | `reinforcing` | Change builds on itself |
| An odd number | `balancing` | Change pushes back |
| Polarity missing | `unknown` | Can't be classified |

Across Perspectiva's 16 diagrams, it finds 89 loops: 59 reinforcing and 30 balancing. Two participants' diagrams have none in either version, so handle an empty list.

### Large graphs

The number of loops can grow very quickly with graph size. Set `maxLength` on large graphs, and use `through` to search around one node. `complete` is `false` when `maxLength` or `limit` may have hidden loops, so don't present a capped list as the full count.

| Maximum length in Explorer | Loops |
| :--- | :--- |
| 3 | 18 |
| 4 | 57 |
| 5 | 159 |
| 6 | 463 |

These counts, and every Perspectiva loop and type, match NetworkX's `simple_cycles`.

To show a loop, pass it to `highlightLoop(cy, loop)`, which adds `loop-node` and `loop-link` classes and dims everything else. Pass `null` to clear it.

## Causes and effects

Highlighting a neighbourhood should separate what leads into a node from what comes out of it. `highlightCausalNeighbours` adds classes for you to style:

```ts
import { highlightCausalNeighbours } from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";

export function followSelection(cy: Core, selected: string[]) {
  highlightCausalNeighbours(cy, selected);
}
```

| Class | Applied to |
| :--- | :--- |
| `focus` | The given nodes |
| `cause`, `cause-link` | Direct causes and their links |
| `effect`, `effect-link` | Direct effects and their links |
| `dimmed` | Everything else |

Use `node.incomers()` and `node.outgoers()` for this. `node.neighborhood()` ignores direction.
