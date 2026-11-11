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

Cycle configuration, count, timing and selection share one sidebar panel. Selecting a node scopes the list; the scope selector can switch to all nodes. Path endpoint selection also starts in the sidebar. The graph menu only changes steps and traverses adjacent nodes.

- Plain-click a node to select it and show details, without opening the menu. Search selects and positions only.
- Hold a node for about 400 ms to open the menu and lock it, without moving the camera. The node gets a border while the menu is locked.
- While locked, crossing the chosen fan’s outer edge enters the next step: the chosen neighbour becomes the new fan centre, with angles and radii recomputed from its own neighbours. The earlier path stays locked; steering chooses only the next edge. Return toward the preceding centre to go back. Already visited nodes are excluded, dead ends do not open another fan, and `maxDepth` caps the number of steps. A click, or letting go of the press that locked the menu, commits the final node and the traversed path, and the locked menu moves to that node. The current centre has a compact, translucent sunburst without an outline: each segment follows an adjacent node’s real direction, and the chosen direction darkens. It keeps the halo’s size and moves with the small step number between levels. Fan areas and their transitions are visible only with direction debugging enabled. The earlier path remains highlighted, with a small step number above the current centre; fan fills and outlines stay hidden during normal use. Reduced-motion preferences disable these animations.
- There is no need to keep holding: move toward an adjacent-node direction or step ring to preview it.
- Click outside the canvas, or press Escape, to leave: the menu closes, the border goes, and the selection stays. Clicks on the menu’s own rings and buttons don’t leave, and a click with no target does nothing.
- Once the menu is closed, click empty canvas to clear the retained selection and highlight.
- Moving more than 8 px before the hold activates performs a normal node drag. Escape cancels a held preview and closes the menu, retaining the origin.
- Shift-click and Shift-box remain multi-selection gestures and do not open a held menu. The open menu still owns graph interaction.
- Keyboard alternative: focus the graph and use Shift+F10 / Context Menu on the cursor or single selected node, then Tab and Enter.


## States and priority

| State | Enter | Behaviour | Exit |
| :--- | :--- | :--- | :--- |
| Browse / node selection | Plain click or search | Hover previews, click selects; details in the sidebar, menu closed | Empty canvas or Clear selection clears; hold opens the menu |
| Locked menu | Hold a node for about 400 ms; the node is bordered | Graph-level modal: bright and faded elements cannot independently intercept input; move, with or without the button held, over adjacent-node directions or step controls to preview; a click commits, and the menu moves to the node reached | A click outside the canvas, or Escape, closes it and keeps the selection |
| Retained highlight | Commit a menu choice or click a route control | Keeps the selected node, connection route or loop; ordinary hover does not replace it | Empty canvas / Clear selection clears; a new selection replaces it |
| Multi-selection | Shift-click or Shift-box outside the menu | Unlimited nodes; all details and a sparse directed shortest-path connection. Disconnected selected nodes remain bright | Shift-click removes one; plain click replaces with one; empty canvas clears |
| Trace endpoint | Choose ⤳ in the menu | Fans disabled; choose another node to finish. Sidebar gives the next instruction | Escape, origin or background cancels and retains the origin |
| Link details | Click a link outside the menu or use a sidebar link button | Keeps the link and endpoints highlighted, no menu | Same link, empty canvas or Clear selection exits |

Closing the menu and clearing selection are separate. Leaving the locked menu closes it without clearing the committed highlight, and the press that locked it never becomes an extra ordinary click.

Preview never changes selection. Highlight priority: temporary route preview → retained route/link → selected node(s) → ordinary hover. While open, the menu owns pointer interpretation; Shift cannot bypass it, and box selection and background node dragging are disabled. Ordinary interaction resumes on close.

Multi-selection uses one directed shortest path per candidate connection, then greedily joins disconnected selections while preferring fewer new edges and intermediate nodes. Existing paths are reused. This is a sparse approximation, not a globally optimal Steiner network. Unreachable selections remain highlighted; shortest paths have no eight-node cutoff.

## Menu controls

| Control | Move while locked | Click, or let go of the locking press |
| :--- | :--- | :--- |
| Direction fan | Preview neighbour and connection route | Select neighbour and retain route highlight |
| Loop arc | Preview feedback loop | Retain origin and loop highlight |
| Step ring | Preview neighbourhood depth | Retain depth and origin |
| ⤳ | Explain path tracing | Close menu and enter endpoint picking |
| No fan or control | Restore origin highlight | Nothing: the menu stays locked |

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

Multi-selection uses one directed shortest path per candidate connection, then greedily joins disconnected selections while preferring fewer new edges and intermediate nodes. Existing paths are reused. This is a sparse approximation, not a globally optimal Steiner network. Unreachable selections remain highlighted; shortest paths have no eight-node cutoff.

### Layout loading

Initial drawing and layout changes show an “Arranging graph…” status before computation starts. It clears when the layout settles. Switching again supersedes the previous job; failures offer Retry. Saved positions are reused when returning to a layout. Layouts with at least 50 visible nodes compute in a dedicated Web Worker; only position application and animation run on the main thread. Cancel layout terminates the worker, while switching layouts discards the old result. Preset and cached positions skip computation. Bundled layouts preserve node dimensions, spacing and centrality callbacks; unsupported custom worker options report an error instead of silently blocking the main thread.
