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

## Press-and-hold menu

- Plain-click a node to select it and show details, without opening the menu. Search selects and positions only.
- Hold a node for about 400 ms to open the menu without moving the camera.
- While held, angle chooses the link. Each direction retains its original fan radius, based on its neighbouring node: inside that fan is step 1, beyond it is step 2, subsequent boundaries follow the farthest node reached in each causal layer (with the same outer padding), capped at `maxDepth`. Inward layers share the existing extent; missing layers add no distance band. Only the chosen angular sector shows distance bands and highlights the current step; dragging back reduces steps.
- Keep holding and move toward a fan, loop arc, or step ring to preview it.
- Release to commit the preview and close the menu, retaining node/connection/loop highlights. Releasing without a target retains the origin.
- Click empty canvas to clear the retained selection and highlight.
- Moving more than 8 px before the hold activates performs a normal node drag. Escape cancels a held preview and closes the menu, retaining the origin.
- Shift-click and Shift-box remain multi-selection gestures and do not open a held menu. The open menu still owns graph interaction.
- Keyboard alternative: focus the graph and use Shift+F10 / Context Menu on the cursor or single selected node, then Tab and Enter.

## States and priority

| State | Enter | Behaviour | Exit |
| :--- | :--- | :--- | :--- |
| Browse / node selection | Plain click or search | Hover previews, click selects; details in the sidebar, menu closed | Empty canvas or Clear selection clears; hold opens the menu |
| Held menu | Hold a node for about 400 ms | Graph-level modal: bright and faded elements cannot independently intercept input; move over fans, loops or step controls to preview | Release closes and commits; Escape discards the preview and retains the origin |
| Retained highlight | Release a menu choice or click a route control | Keeps the selected node, connection route or loop; ordinary hover does not replace it | Empty canvas / Clear selection clears; a new selection replaces it |
| Multi-selection | Shift-click or Shift-box outside the menu | Unlimited nodes; all details and both directions for every node pair. Disconnected selected nodes remain bright | Shift-click removes one; plain click replaces with one; empty canvas clears |
| Trace endpoint | Choose ⤳ in the menu | Fans disabled; choose another node to finish. Sidebar gives the next instruction | Escape, origin or background cancels and retains the origin |
| Link details | Click a link outside the menu or use a sidebar link button | Keeps the link and endpoints highlighted, no menu | Same link, empty canvas or Clear selection exits |

Closing the menu and clearing selection are separate. Release closes the menu without clearing the committed highlight or generating an extra ordinary click.

Preview never changes selection. Highlight priority: temporary route preview → retained route/link → selected node(s) → ordinary hover. While open, the menu owns pointer interpretation; Shift cannot bypass it, and box selection and background node dragging are disabled. Ordinary interaction resumes on close.

Each ordered node pair retains the default search bounds: at most 8 nodes per path and 50 paths per direction; `+` marks truncated results. Selection is unlimited by default; embedding apps may still configure `maxSelected` explicitly.

## Menu controls

| Control | Move while held | Release |
| :--- | :--- | :--- |
| Direction fan | Preview neighbour and connection route | Select neighbour and retain route highlight |
| Loop arc | Preview feedback loop | Retain origin and loop highlight |
| Step ring | Preview neighbourhood depth | Retain depth and origin |
| ⤳ | Explain path tracing | Close menu and enter endpoint picking |
| No fan or control | Restore origin highlight | Close and retain origin |

Fans use real angular Voronoi directions, capped at 60° on either side of the neighbour, from the origin's edge to just past the neighbour. Default `maxDepth: 2` provides one two-step ring, configurable through `graphOptions.maxDepth`.

## Keyboard and details

With graph focus, arrows move the node cursor; Enter/Space selects. Shift+F10 or Context Menu opens a keyboard menu for the cursor or single selected node; Tab reaches controls, Enter/Space activates. A keyboard menu has no held mouse, so Escape follows the layered exit rules: cancel tracing or a pinned route first, then clear selection. Clear selection always exits everything.

Nodes have no tooltip by default: labels stay on the graph and details/evidence in the sidebar. Modal backdrop has no link tooltip. Without a sidebar, use `renderNodeInfo` / `renderInfo` for a details card. Search and sidebar remain explicit commands; this is not a page-wide dialog.

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
| `depth`, `setDepth(steps)` | How many links away the highlight reaches |
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

Multi-selection searches each ordered node pair with the existing path limits: at most 8 nodes per path and 50 paths per direction. A `+` count marks a truncated search. The graph merges these results and keeps disconnected selected nodes bright.
