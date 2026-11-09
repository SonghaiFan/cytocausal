---
title: "Stable layouts and anchoring"
---

# Stable layouts and anchoring

To compare two versions of a graph, a reader needs matching nodes in matching places. A force-directed layout won't give you that on its own, because it arranges each graph independently. Anchoring fixes the layout of one version and places the other around it.

`CompareView` does all of this:

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import { CompareView } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";
import { useRef } from "react";

const stylesheet: Stylesheet[] = [{ selector: "node", style: { label: "data(label)" } }];

export function Comparison({ dataset }: { dataset: CausalDataset }) {
  const positionCache = useRef<Record<string, Positions>>({});
  return (
    <CompareView
      dataset={dataset}
      left="V1"
      right="final"
      layout={fcoseLayout}
      stylesheet={stylesheet}
      positionCache={positionCache}
    />
  );
}
```

## How anchoring works

1. The left graph runs its layout.
2. Its positions go through the dataset's correspondence, so they're keyed by right-graph ids.
3. The right graph pins those nodes and lets fcose place the rest around them.

The same steps with the lower-level functions:

```ts
import { alignPositions, getCounterparts, placeAround, type Positions } from "@cytocausal/cytoscape";
import type { CausalDataset } from "@cytocausal/core";
import type { Core } from "cytoscape";

export function placeFinal(cy: Core, dataset: CausalDataset, v1Positions: Positions) {
  const counterparts = getCounterparts(dataset, "V1", "final");
  const anchors = alignPositions(v1Positions, counterparts);
  placeAround(cy, anchors)?.run();
}
```

`getCounterparts` works in either direction. `alignPositions` puts a merged node at the centre of its sources.

## Pin nodes instead of moving them

The first version of this ran a full layout on the right graph, then moved the matching nodes afterwards. That failed in two ways:

- A slower layout finished later and overwrote the moved nodes. With cola, every anchored node ended up in the wrong place.
- New nodes stayed where the old layout left them, and collided with nodes moved in beside them.

fcose's `fixedNodeConstraint` solves both, because it arranges new nodes around fixed ones in a single pass. Only fcose supports this, so the right graph uses fcose even when cola is selected for the left.

## Don't run a layout that will be replaced

The right graph starts hidden in a cheap `grid` layout until the left graph's positions arrive. Without that, a slow layout could finish after anchoring. Hiding it means readers never see the placeholder.

## Skip animation on first render

An animated first layout has no earlier state to move from. Nodes fly in from the origin, which shows nothing about the data. `GraphView` sets `animate: false` for a first render and saves animation for real changes.

## Keep positions with the right data

Positions only make sense for the dataset and layout that produced them. `CompareView` tags them with both and ignores any that don't match, so a late result from the previous dataset can't reach the right graph.

## Share a position cache

`positionCache` is keyed by dataset, layout and snapshot. Every view writes to it, so the `1 Graph` view of a version matches the same version in the `2 Graphs` view exactly.

## Choose a layout

`layouts` from `@cytocausal/cytoscape` holds every layout Cytoscape ships, and the extensions this package registers, each set up for causal graphs. Pass one as `layout`, or several as `layouts` to let people choose.

| Name | What it does | Suits |
| :--- | :--- | :--- |
| `fcose` | Force-directed, fast and even | Most graphs, and anchoring versions |
| `cola` | Force-directed, animated as it settles | Small graphs where watching it settle helps |
| `dagre` | Ranks running causes into effects from left to right, with loops broken where they must be | Reading causal order |
| `breadthfirst` | Trees grown downwards from what nothing causes | Graphs with few loops and clear starting causes |
| `concentric` | Rings, with the most central nodes in the middle, by `score` data or else degree | Finding the hubs |
| `cose` | Cytoscape's built-in force layout | When fcose isn't available. fcose is usually better |
| `circle`, `grid` | One circle or a grid, ordered by how central each node is | Comparing nodes, not structure |
| `random` | Random positions | Testing |

```tsx
import { layouts } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";

// Defined once, so the choice keeps its positions
const choices = { force: layouts.fcose, flow: layouts.dagre, hubs: layouts.concentric };

export const App = ({ dataset }) => <CausalWorkspace dataset={dataset} layouts={choices} />;
```

Any other Cytoscape layout works too. Register its extension once with `cytoscape.use`, then pass its options. Keep layout objects stable between renders: positions are cached for each one, so two set-ups of the same layout, such as concentric by centrality and by degree, each keep their own.

### Spacing that adapts

Fixed spacing suits one node size only. Pills that hold long labels are several times wider than dots, so with a fixed link length they'd be packed into each other. The force layouts work their spacing out from each node's size instead: a link's ideal length is enough to clear both its nodes plus a gap, and bigger nodes push harder. dagre and the ring layouts already allow for node size.

Curved links bow in proportion to their length, from `curveLinks`. A long link, such as one running back against a flow, arcs clear of the links it would otherwise lie on. Links running each way between two nodes bow to opposite sides. `GraphView` updates the bends whenever nodes settle or are dragged.

`layoutQuality(cy)` counts what makes a layout hard to read, as drawn: overlapping nodes, links through nodes and crossing links. Use it to compare layouts for your data. Ring layouts can't keep every link clear of the nodes between rings, so expect a few links through nodes with `concentric`.

## Switch layouts on the same graph

Pass `animateLayouts` to `GraphView` to move nodes into a new `layout` instead of rebuilding the graph. `CausalGraph` does this for you, so changing `layout` on `CausalProvider` is enough. Each layout's positions go in the position cache, so switching back returns every node to where it was. A saved layout returns nodes to the positions in the data.

Layouts each pick their own origin. Concentric centres on the canvas, so its nodes would fly off screen before the view caught up. So a layout is worked out first and centred where the graph is now. Nodes travel in straight lines, so they stay inside the area holding both where they start and where they end: if that's off screen, the view backs out to it first, then closes in once they arrive. `measureLayout(cy, layout)` gives those positions on their own.

The layout isn't scaled to fit the old one. Shrinking positions without shrinking nodes packs them into each other: an earlier version squeezed a wide flow into the square a ring layout had filled, and four pairs of nodes overlapped.

`relayout(cy, layout)` does the same on any graph. It lays out only visible nodes, so after a filter hides some, the rest can be laid out on their own. Hidden nodes keep their place for when the filter is cleared.

Causal Explorer offers four: its original positions, a force layout for the nodes shown, rings by centrality, and a left-to-right flow.

## Limits

Anchored positions are exact, but some overlap can remain. A label that grew between versions makes its node wider, and it can't move without losing its place. The two graphs also fit their own bounds, so they can open at different zoom levels even when coordinates match.
