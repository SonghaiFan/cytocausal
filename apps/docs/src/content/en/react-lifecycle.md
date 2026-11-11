---
title: "React lifecycle"
---

# React lifecycle

`GraphView` manages a Cytoscape instance from React props, including creation, updates and cleanup. Use it when composing an interface below the `CausalWorkspace` level.

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

Keep `layout` and `stylesheet` stable by defining them outside the component or memoising them. Stylesheet changes restyle the existing instance; layout changes animate when `animateLayouts` is enabled and otherwise rebuild it.

## Rebuild or update

| Change | What happens |
| :--- | :--- |
| Dataset | Destroy the instance and build a new one |
| Stylesheet | Restyle the existing instance |
| Layout | Animate with `animateLayouts`; otherwise rebuild |
| Snapshot, with `animateSnapshots` | Keep the instance and animate |
| Snapshot, without `animateSnapshots` | Destroy the instance and build a new one |

Use `animateSnapshots` to preserve node continuity across versions. See [Version transitions](/en/version-transitions/).

## Listeners outlive renders

Cytoscape listeners are attached once, but React props change. A listener that closes over a prop keeps seeing the value from when it was attached. Reading through a ref avoids that:

```tsx
import type { Core, EventObject } from "cytoscape";
import { useEffect, useRef } from "react";

export function useNodeClicks(cy: Core | null, onClick: (id: string) => void) {
  const latest = useRef(onClick);
  useEffect(() => {
    latest.current = onClick;
  });

  useEffect(() => {
    if (!cy) return;
    const handler = (event: EventObject) => latest.current(event.target.id());
    cy.on("tap", "node", handler);
    return () => { cy.off("tap", "node", handler); };
  }, [cy]);
}
```

The effect removes its listener when the instance changes or the component unmounts.

## Use onReady for custom behaviour

For the usual selection and view controls, use [`useCausalGraph`](/en/interactions/). For anything else, `GraphView` passes each new Cytoscape instance to `onReady`. Attach listeners there, and store the instance in a ref for later calls such as zooming to a node. A new instance arrives after every rebuild, so don't assume there's only one.

## Hidden tabs stop animations

Browsers may pause animation frames in hidden tabs. Animation completion can be delayed until the page is visible; avoid depending on it for unrelated application work.