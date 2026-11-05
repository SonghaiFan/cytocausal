---
title: "Scale and performance"
---

# Scale and performance

Before committing to one renderer, we tested whether Cytoscape could handle Causal Explorer's graph, with 725 nodes and 1,494 edges. Measurements were on an Apple M4 Mac, so expect less on older machines.

| Task | Result |
| :--- | :--- |
| Zoom and pan, canvas renderer | 60 fps |
| Zoom and pan, WebGL renderer | 56 fps |
| Zoom and pan with all 725 labels | 60 fps |
| First render with saved positions | 118 ms |
| Highlight a node's neighbours | 52 ms |
| Find strongly connected components | 322 ms |
| Directed betweenness centrality | 58 ms |
| Full fcose layout | 1–4 s, blocking the page |

So the canvas renderer is enough at this size, and the WebGL option added nothing. Test your own graph, as these numbers depend on the styles you use.

## Keep slow layouts away from page load

A full fcose layout blocks the page for seconds, so compute positions once and save them:

```ts
import type { LayoutOptions } from "cytoscape";

export const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;
```

Explorer's `import-data` script does this along with its analysis. Choose a coordinate scale that fits a screen at around normal zoom. Explorer's first scale was four times too large, so the first view zoomed out until nodes were barely visible.

## Labels need collision handling

Cytoscape's `min-zoomed-font-size` looks like the right tool for hiding labels, but a dense graph needs more. Label size grows with zoom, so most labels pass the threshold at about the same moment. In Explorer, one zoom step took the view from a handful of labels to all of them, stacked unreadably.

`apps/explorer/src/labels.ts` does what Sigma's label grid does:

1. Rank nodes by importance.
2. Place labels in that order, skipping any that would overlap one already placed.
3. Set the font size to a constant divided by zoom, so text stays readable.
4. Repeat only after zooming stops, because restyling every frame is slow.

Node positions and sizes are known, but label widths are estimated from text length. Add a margin for that.

## Look at the result

The label problem passed every test, including the one for performance. The numbers were fine and the screen was unreadable. Check screenshots at several zoom levels, and turn what you find into a test: Explorer now counts overlapping labels at each zoom level.
