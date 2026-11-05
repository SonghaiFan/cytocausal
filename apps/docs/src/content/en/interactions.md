---
title: "Interactions"
---

# Interactions

`useCausalGraph` gives a graph the interactions people expect: selecting and hovering nodes, highlighting causes, effects and loops, and moving the view. Connect it by passing `attach` to `onReady`:

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { createCausalStyle, fcoseLayout, lightTheme, type Positions } from "@cytocausal/cytoscape";
import { GraphView, NodeSearch, useCausalGraph } from "@cytocausal/react";
import { useRef } from "react";

const stylesheet = createCausalStyle(lightTheme);

export function Explorer({ dataset }: { dataset: CausalDataset }) {
  const [snapshot] = dataset.snapshots;
  const graph = useCausalGraph({ maxSelected: 2 });
  const positionCache = useRef<Record<string, Positions>>({});

  return (
    <>
      <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
      <button onClick={graph.zoomIn}>Zoom in</button>
      <button onClick={graph.zoomOut}>Zoom out</button>
      <button onClick={graph.fit}>Fit</button>
      <p>{graph.selected.length} selected</p>
      <GraphView
        dataset={dataset}
        snapshotId={snapshot.id}
        layout={fcoseLayout}
        stylesheet={stylesheet}
        positionCache={positionCache}
        onReady={graph.attach}
      />
    </>
  );
}
```

## What you get

| Interaction | Result |
| :--- | :--- |
| Hover a node | Highlights it, its causes and its effects |
| Click a node | Keeps that highlight, and adds the node to `selected` |
| Click it again | Deselects it |
| Click the background | Clears the selection |

Highlights have a fixed order: a highlighted loop comes first, then selected nodes, then the hovered node. So hovering doesn't disturb what someone has selected.

## Options

| Option | Default | What it does |
| :--- | :--- | :--- |
| `maxSelected` | `1` | How many nodes can be selected. The oldest is dropped when it's exceeded |
| `selectable` | `true` | Turn off to handle clicks and hovers yourself |
| `readableLabels` | `false` | Keeps labels from overlapping. Needs `managedLabels` in `createCausalStyle` and a `score` on each node |
| `focusZoom` | Current zoom | The zoom level `focus` moves to |
| `motion` | Theme default | Animation durations |

## What it returns

| Name | Use |
| :--- | :--- |
| `attach` | Pass to `onReady` |
| `selected`, `hovered`, `activeLoop` | The current state, to show in your own panels |
| `toggle(id)` | Selects or deselects a node |
| `focus(id)` | Selects a node and moves the view to it |
| `clear()` | Clears the selection and loop |
| `keepSelected(test)` | Drops selected nodes that fail a test, such as after filtering |
| `toggleLoop(loop)` | Highlights a loop from `findFeedbackLoops` |
| `zoomIn()`, `zoomOut()`, `fit()` | Moves the view |
| `cy` | A ref to the Cytoscape instance, for anything else |

## Two graphs

Each hook controls one graph. For a comparison, use one hook per graph and connect them through `onReady` on `CompareView`, which passes the snapshot id as well. `apps/perspectiva` does this.
