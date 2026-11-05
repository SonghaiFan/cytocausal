---
title: "Version transitions"
---

# Version transitions

Switching between versions should show what changed. Rebuilding the graph can't do that, because nothing on screen carries over. `GraphView` with `animateSnapshots` keeps one graph and transforms it:

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import { GraphView } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";
import { useRef, useState } from "react";

const stylesheet: Stylesheet[] = [{ selector: "node", style: { label: "data(label)" } }];

export function VersionSwitcher({ dataset }: { dataset: CausalDataset }) {
  const [version, setVersion] = useState("V1");
  const positionCache = useRef<Record<string, Positions>>({});
  return (
    <>
      <button onClick={() => setVersion(version === "V1" ? "final" : "V1")}>Switch</button>
      <GraphView
        dataset={dataset}
        snapshotId={version}
        layout={fcoseLayout}
        stylesheet={stylesheet}
        positionCache={positionCache}
        animateSnapshots
      />
    </>
  );
}
```

| Node | What happens |
| :--- | :--- |
| Has a counterpart | Moves from its old position to its new one |
| Merged from several | Starts at the centre of its sources |
| New in this version | Fades in at its target position |
| Gone from this version | Fades out, then is removed |

Edges cross-fade, because old and new links rarely line up.

## Known and unknown targets

When a version's positions are cached, `transitionToSnapshot` animates straight to them, so switching back and forth never drifts. When they aren't, it pins nodes that have counterparts and lets fcose place the rest. The result is then cached, so later switches are exact.

## Interrupted transitions

Users click faster than animations run, and every problem we hit came from a transition being interrupted. All three of these are handled in `transitionToSnapshot`, and they apply to any Cytoscape animation code.

### Stopping a layout fires layoutstop

`layout.stop()` fires `layoutstop` straight away, with nodes still in mid-flight. If that listener saves positions, it saves wrong ones. A transition marks itself as the current one before stopping the previous one, and a listener only runs if its transition is still current.

### Interrupted animations never complete

An animation's `complete` callback doesn't run after `stop()`. Cleanup placed there is skipped, which leaves stray elements on the graph. Use a timer that checks the transition is still current.

### The animation pool tracks elements by id

Removing an element and adding a new one with the same id strands the new element's animations. Cytoscape's pool still holds the removed element, so it treats the new one as already registered and never runs its animations. The element stays flagged as animating forever.

The fix is to not remove leftovers when interrupted. They stay in the graph for the next transition to reuse or fade out.

## Test the interruptions

Each of these bugs looked correct on screen, or only appeared with rapid clicking. Test what you can't see: after rapid switching, check that nothing is still animating, nothing is half-faded, and positions match the first visit. `apps/perspectiva/e2e/graph.spec.ts` does this for every dataset.
