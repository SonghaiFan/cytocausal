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

## Select and explore

Click a node to select it and read its details in the sidebar. Search selects and focuses a node. Click empty canvas or use Clear selection to clear the selection. Shift-click or Shift-drag a selection box to select multiple nodes; reachable selections are connected by directed paths.

Use the sidebar to configure feedback-loop searches, select a loop, or choose path endpoints. Selecting a node scopes the loop list; the scope control can include all nodes.

Multi-selection connects reachable nodes with a sparse set of directed paths; it does not guarantee a globally minimal network. Disconnected selections remain highlighted.

## Press-and-hold menu

1. Hold a node for about 400 ms to open the exploration menu. Moving before the menu opens drags the node instead.
2. Point toward a neighbouring node to preview a direction. Click to follow it; the menu moves to that node and the traversed path stays highlighted. Releasing the press that opened the menu also commits the current preview.
3. Continue through neighbours to extend the path. Numbered nodes show the order of the walk. A link already traversed is not offered again.
4. Press Escape or click outside the menu's active area to close it while keeping the committed selection and path. Click empty canvas again to clear them.

The step ring previews a larger neighbourhood for the current selection. `graphOptions.maxDepth` controls the available depth. Selection and hover start at `defaultDepth`.

## Keyboard and details

With graph focus, arrow keys move the node cursor and Enter or Space selects. Shift+F10 or the Context Menu key opens the menu for the cursor or single selected node. Use Tab to reach controls and Enter or Space to activate them. Escape exits the active interaction layer; Clear selection resets all interaction state.

Node details and evidence appear in the sidebar. Without a sidebar, use `renderNodeInfo` / `renderInfo` for a details card. A selected route or link stays highlighted while ordinary hover moves elsewhere. Temporary route previews take priority until the preview ends.

## Options

| Option | Default | What it does |
| :--- | :--- | :--- |
| `maxSelected` | `Infinity` | How many nodes can be selected. The oldest is dropped when it's exceeded |
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
| `depth`, `setDepth(steps)` | How many links away the current hover or selection highlights; the next selection starts at `defaultDepth` again |
| `defaultDepth`, `setDefaultDepth(steps)` | How many links away each new hover or selection highlights, 1 unless set; `DepthControl` sets it |
| `announcement` | Text for a live region |
| `toggle(id)` | Selects or deselects a node |
| `focus(id)` | Selects a node and moves the view to it |
| `clear()` | Clears all interaction state |
| `dismiss()` | Exits the current interaction layer |
| `keepSelected(test)` | Drops selected nodes that fail a test, such as after filtering |
| `toggleRoute(route)` | Highlights a loop from `findFeedbackLoops` or a path from `findCausalPaths` |
| `zoomIn()`, `zoomOut()`, `fit()` | Moves the view |
| `cy` | A ref to the Cytoscape instance, for anything else |

## Two graphs

Each hook controls one graph. For a comparison, use one hook per graph and connect them through `onReady` on `CompareView`, which passes the snapshot id as well. `apps/perspectiva` does this.

### Layout loading

Initial drawing and layout changes show an “Arranging graph…” status before computation starts. It clears when the layout settles. Switching again supersedes the previous job; failures offer Retry. Saved positions are reused when returning to a layout. Layouts with at least 50 visible nodes compute in a dedicated Web Worker; only position application and animation run on the main thread. Cancel layout terminates the worker, while switching layouts discards the old result. Preset and cached positions skip computation. Bundled layouts preserve node dimensions, spacing and centrality callbacks; unsupported custom worker options report an error instead of silently blocking the main thread.
