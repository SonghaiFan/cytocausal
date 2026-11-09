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

`keepLabelsReadable` does what Sigma's label grid does. Turn it on with `readableLabels` in [`useCausalGraph`](/en/interactions/):

1. Rank nodes by what the reader is looking at first: the selected node and the keyboard cursor, then a highlighted loop or path, then causes and effects, and then centrality.
2. While anything is highlighted, give dimmed nodes no label. They are background, and their labels would crowd out the ones that matter.
3. Try each label above, below, right and left of its node, and keep the first spot that covers no other label and no other node. A selected node keeps its label even where nothing is free.
4. Size text, its outline and the gap to the node as a constant divided by zoom, so they look the same at every zoom. Links and their arrows keep a constant size too, so they don't swell as you zoom in. Cytoscape draws an arrow at least 29 units wide whatever the line's width, so arrows need their own scale.
5. Repeat after zooming stops, because restyling every frame is slow, and whenever a highlight changes.

Labels are measured with the browser's own text metrics and wrapped the way Cytoscape wraps them. Wrapping can still differ by a pixel, so the labels chosen are then checked against the boxes Cytoscape actually drew, and a less important one that clashes is dropped.

A highlight used to force a label onto every node it touched, which skipped all of this. Three steps out from a central event in Explorer, that stacked about 80 labels on top of each other.

## Look at the result

The label problem passed every test, including the one for performance. The numbers were fine and the screen was unreadable. Check screenshots at several zoom levels, and turn what you find into a test: Explorer now counts overlapping labels at each zoom level, and at each highlight depth.
