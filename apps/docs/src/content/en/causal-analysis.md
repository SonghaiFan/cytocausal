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

Explorer's network has one such group with 213 of its 725 nodes, about 29% of the graph, and matches the result from NetworkX. The app can isolate loops with "Show only feedback loops".

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

The number of loops can grow very quickly with graph size. Set `maxLength` on large graphs, and use `through` to search around one node. `complete` is `false` when `maxLength` or `limit` may have hidden loops, so don't present a capped list as the full count. The search goes one length at a time, so a list cut short by `limit` still holds the shortest loops.

| Maximum length in Explorer | Loops |
| :--- | :--- |
| 3 | 18 |
| 4 | 57 |
| 5 | 159 |
| 6 | 463 |

These counts, and every Perspectiva loop and type, match NetworkX's `simple_cycles`.

To show a loop, pass it to `highlightRoute(cy, loop)`, which adds `route-node` and `route-link` classes and dims everything else. Pass `null` to clear it.

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

Pass a depth to reach further: `highlightCausalNeighbours(cy, selected, 2)` also marks the causes of causes and the effects of effects. In a loop, a node can be both.

## Paths

`findCausalPaths` lists the routes from one node to another, following the direction of each link. No route visits a node twice.

```ts
import { findCausalPaths, type Snapshot } from "@cytocausal/core";

export function routes(snapshot: Snapshot) {
  const { paths, complete } = findCausalPaths(snapshot, "customers", "queue", {
    maxLength: 8,
    limit: 50,
  });
  return complete ? paths : paths.slice(0, 10);
}
```

Paths come shortest first, and a list cut short by `limit` holds the shortest ones. `maxLength` counts nodes. `complete` is `false` when `maxLength` or `limit` may have hidden some paths.

## Version differences

`diffSnapshots` compares two snapshots. It uses the dataset's correspondences in either direction, and falls back to matching ids when there are none. Reading it the other way swaps added and removed, and merged and split. An unknown snapshot id throws an error that names the snapshots the dataset has.

```ts
import { diffSnapshots, type CausalDataset } from "@cytocausal/core";

export function summary(dataset: CausalDataset) {
  const diff = diffSnapshots(dataset, "V1", "final");
  return `${diff.addedNodes.length} added, ${diff.removedNodes.length} removed`;
}
```

| Field | Contains |
| :--- | :--- |
| `addedNodes`, `removedNodes` | Nodes with no counterpart |
| `renamedNodes` | Nodes whose label changed, as `{ from, to }` |
| `mergedNodes` | Several nodes that became one, as `{ from, to }` |
| `splitNodes` | One node that became several, as `{ from, to }` |
| `regroupedNodes` | Several nodes that became several others, as `{ from, to }` |
| `addedLinks`, `removedLinks` | Links with no counterpart |
| `changedLinks` | Links whose polarity changed, as `{ from, to, polarity }` |

Links are compared by the nodes they join, so parallel links between two nodes count as one. When they disagree, their polarity is `"mixed"`.

To mark a diff on a graph, `changeMarks(diff, side)` sorts it into what one snapshot can show: `"from"` for the earlier, with what was removed, or `"to"` for the later, with what was added. Both include what's in both versions but changed: renamed, merged, split or regrouped nodes, and links whose polarity flipped. Pass the result to `highlightChanges`. Added parts are blue and removed parts vermilion. What stayed the same fades, so changed parts stand out by keeping full contrast, with `±` on flipped links.

### Interactive cycle searches

Browser views run cycle enumeration in a Web Worker. The core search first isolates strongly connected components, keeping singleton self-loops and discarding edges between components. Results remain shortest first. Changing the graph, selected node or length terminates the previous worker; cancellation terminates computation rather than just hiding its result. Cancelled and failed searches are not shown as empty completed results.

`LoopSettingsProvider` and `LoopSearchControls` share the length and cancellation state across the lists and radial menus of a case. `CausalProvider` accepts `loopSettings`; standalone views can use `LoopSettingsProvider` with `useLoopSearch`. The synchronous core API remains available for scripts.

| Case | Label | Initial maximum length | Result limit per search |
| --- | --- | --- | --- |
| Explorer | Event cycles | 4 | 30 |
| Perspectiva participant | Participant cycles | Unlimited | 1000 |
| Perspectiva combined | Workshop cycles | 6 | 1000 |
| Starter | Coffee shop cycles | Unlimited | 1000 |

Length counts nodes (including one-node self-loops), independently of the neighbourhood's “Steps shown”. Removing the length bound does not remove the result limit. A `+` on a result count means the search may be incomplete. The combined and participant scenarios reset their settings when the dataset changes.

The cancel button is shown only while workers are running. Completed lists show their cycle count and elapsed time. The shared controls deduplicate cycles within each snapshot and show the longest completed search time; cancelled and failed searches are not reported as completed.
