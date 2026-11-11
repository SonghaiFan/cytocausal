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

## Switching before an animation finishes

A new snapshot selection can interrupt an active transition. `GraphView` manages the transition lifecycle; pass the latest `snapshotId` rather than removing and recreating graph elements yourself. Cached positions are reused when returning to a version.

If you manage a Cytoscape instance directly, use `transitionToSnapshot`. See the [Cytoscape integration API](/en/api-cytoscape/) for the lower-level interface.
