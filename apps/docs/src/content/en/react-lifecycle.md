---
title: "React lifecycle"
---

# React lifecycle

Cytoscape and React both want to own what's on screen. cytocausal keeps them apart: React decides what to show, and one long-lived Cytoscape instance draws it. `GraphView` in `@cytocausal/react` does this for you, and this guide explains why it works the way it does.

## Render in the browser only

Cytoscape needs the DOM, so it can't run during server rendering. In Next.js, load the part of the app that uses it with `next/dynamic`:

```tsx
"use client";
import dynamic from "next/dynamic";

export const AppLoader = dynamic(() => import("./App").then((module) => module.App), {
  ssr: false,
  loading: () => <p>Loading…</p>,
});
```

The options must be written inline at the call. Next.js rejects a variable there with "next/dynamic options must be an object literal".

## Use GraphView

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import { GraphView } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";
import { useRef } from "react";

const stylesheet: Stylesheet[] = [{ selector: "node", style: { label: "data(label)" } }];

export function Diagram({ dataset }: { dataset: CausalDataset }) {
  const positionCache = useRef<Record<string, Positions>>({});
  return (
    <GraphView
      dataset={dataset}
      snapshotId="V1"
      layout={fcoseLayout}
      stylesheet={stylesheet}
      positionCache={positionCache}
    />
  );
}
```

Keep `layout` and `stylesheet` stable by defining them outside the component. `GraphView` rebuilds the graph when either changes, so a new object on every render would rebuild it every time.

## Rebuild or update

| Change | What happens |
| :--- | :--- |
| Dataset or layout | Destroy the instance and build a new one |
| Snapshot, with `animateSnapshots` | Keep the instance and animate |
| Snapshot, without `animateSnapshots` | Destroy the instance and build a new one |

Rebuilding loses every node's identity, so nothing can move smoothly. Perspectiva originally rebuilt on every version change, and each switch looked like a brand new graph. See [Version transitions](/en/version-transitions/).

## Listeners outlive renders

Cytoscape listeners are attached once, but React props change. A listener that closes over a prop keeps seeing the value from when it was attached. Reading through a ref avoids that:

```tsx
import type { Core } from "cytoscape";
import { useEffect, useRef } from "react";

export function useNodeClicks(cy: Core | null, onClick: (id: string) => void) {
  const latest = useRef(onClick);
  useEffect(() => {
    latest.current = onClick;
  });

  useEffect(() => {
    cy?.on("tap", "node", (event) => latest.current(event.target.id()));
  }, [cy]);
}
```

This caused a real bug in Perspectiva. A `layoutstop` listener held on to the old version's cache key, so it saved final positions under the V1 key and corrupted the position cache.

## Use onReady for custom behaviour

`GraphView` passes each new Cytoscape instance to `onReady`. Attach listeners there, and store the instance in a ref for later calls such as zooming to a node. A new instance arrives after every rebuild, so don't assume there's only one.

## Hidden tabs stop animations

Browsers pause `requestAnimationFrame` in hidden pages. Cytoscape animations then never finish, so `layoutstop` never fires on an animated layout, and the canvas stays blank. This can look like a bug in your code when you test in a background tab or a hidden panel. Test in a visible page or a headless browser.
