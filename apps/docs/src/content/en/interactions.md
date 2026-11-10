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
| Click a link | Selects it as `selectedLink` and highlights it with its ends, in place of any selected nodes |
| Click the background | Clears the selection |

Highlights have a fixed order: a highlighted loop comes first, then selected nodes, then the hovered node. So hovering doesn't disturb what someone has selected.

## Radial menu

Selecting one node opens a ring menu around it:

| Ring | What it does |
| :--- | :--- |
| Wedges, nearest the node | One for each linked node, placed the way it lies on the graph. Its arrow follows the link: out to an effect, in from a cause, and both ways for a node that is both. Point at a wedge to preview the link, and choose it to walk there: that node becomes the selection, and the menu moves with it |
| Two thin rings | How many steps the highlight reaches: point at one to preview 2 or 3 steps, and choose it to keep that. Choosing the deepest ring shown goes back a step |
| Outer arcs | The feedback loops through the node, marked `R` or `B`, then, in a lighter shade, loops that don't pass through it but lie within the steps shown. Point to preview a loop, and choose it to keep it highlighted |

The menu uses contrast only, so the accent stays on the node itself. Every item can be reached with Tab and chosen with Enter or Space, and Escape clears the selection. A caption under the menu names what's under the pointer or the keyboard focus.

Pass `loopOptions` to `CausalGraph` to limit the loop search on large graphs. Outside a provider, render `<RadialMenu graph={graph} snapshot={snapshot} />` beside your graph: it positions itself over the selected node.

### Tooltips and the menu

A tooltip answers "what is this?" for a node you haven't chosen. The menu answers "where can I go from here?" for the one you have. They never show at once:

| Pointer | What shows |
| :--- | :--- |
| On the selected node, or anywhere inside the menu's circle | The menu's caption only |
| On a wedge or arc | The caption, and the link or loop highlighted on the graph |
| On another node or link | Its tooltip, beside the pointer on the side away from the menu |
| Moving across the graph | Nothing until it rests for 300 ms, so tooltips don't flash. Set `tooltipDelay` on `GraphView` to change this |
| On a touch screen | No tooltips, since there's no hover. Tapping selects, and details are in the sidebar |

## Keyboard

The graph takes keyboard focus. Selecting needs `selectable`, which is on by default.

| Key | Result |
| :--- | :--- |
| Up, Down | Moves through all the nodes |
| Right | Moves to an effect of the current node |
| Left | Moves to a cause of the current node |
| Enter, Space | Selects or deselects the current node |
| Escape | Clears the cursor and selection |

To reach a link from the keyboard, select a node and use the link button beside each of its causes and effects. `toggleLink` does the same from your own code.

Right and Left go to the first effect or cause. Use Up and Down to reach the others.

Show `announcement` in a live region, so screen readers say where the cursor is:

```tsx
<p role="status" className="cc-sr-only">
  {graph.announcement}
</p>
```

## Options

| Option | Default | What it does |
| :--- | :--- | :--- |
| `maxSelected` | `1` | How many nodes can be selected. The oldest is dropped when it's exceeded |
| `selectable` | `true` | Turn off to handle clicks and hovers yourself |
| `readableLabels` | `false` | Keeps labels from overlapping. Needs `managedLabels` in `createCausalStyle` and a `score` on each node |
| `focusZoom` | Current zoom | The zoom level `focus` moves to |
| `initialSelected` | None | Nodes to start with selected, such as from a shared link |
| `motion` | Theme default | Animation durations |

## What it returns

| Name | Use |
| :--- | :--- |
| `attach` | Pass to `onReady` |
| `selected`, `hovered`, `activeRoute` | The current state, to show in your own panels |
| `previewRoute(route)` | Shows a route for now, such as on hover. Pass `null` to end it |
| `depth`, `setDepth(steps)` | How many links away the highlight reaches |
| `announcement` | Text for a live region |
| `toggle(id)` | Selects or deselects a node |
| `focus(id)` | Selects a node and moves the view to it |
| `clear()` | Clears the selection and loop |
| `keepSelected(test)` | Drops selected nodes that fail a test, such as after filtering |
| `toggleRoute(route)` | Highlights a loop from `findFeedbackLoops` or a path from `findCausalPaths` |
| `zoomIn()`, `zoomOut()`, `fit()` | Moves the view |
| `cy` | A ref to the Cytoscape instance, for anything else |

## Two graphs

Each hook controls one graph. For a comparison, use one hook per graph and connect them through `onReady` on `CompareView`, which passes the snapshot id as well. `apps/perspectiva` does this.
