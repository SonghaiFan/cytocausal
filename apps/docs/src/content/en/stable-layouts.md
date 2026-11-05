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

## Limits

Anchored positions are exact, but some overlap can remain. A label that grew between versions makes its node wider, and it can't move without losing its place. The two graphs also fit their own bounds, so they can open at different zoom levels even when coordinates match.
