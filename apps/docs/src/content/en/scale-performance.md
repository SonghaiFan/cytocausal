---
title: "Scale and performance"
---

# Scale and performance

Graph responsiveness depends on node and edge counts, label density, styles, layout and device. Measure initial rendering, zooming, selection and layout changes with representative data on your target devices.

## Keep slow layouts away from page load

For graphs with saved node positions, use a preset layout to avoid recalculating positions on load:

```ts
import type { LayoutOptions } from "cytoscape";

export const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;
```

Choose coordinates that keep nodes and labels readable in the initial fitted view.

## Labels need collision handling

`min-zoomed-font-size` hides small text but does not prevent label overlap. Dense graphs also need collision handling.

Enable `readableLabels` in [`useCausalGraph`](/en/interactions/) to use `keepLabelsReadable`. Labels are prioritised by selection, keyboard focus, highlighted paths or loops, causal neighbours and centrality. Dimmed nodes yield space to the active selection.

Label placement avoids other nodes and labels where space permits. The selected node retains its label even if no collision-free position is available. Managed text stays a constant screen size as you zoom.

## Check readability

Review the initial view, zoomed views and selections with many neighbours. Check whether labels overlap, selected nodes remain identifiable and interactions respond promptly. A high frame rate alone does not establish readability.
