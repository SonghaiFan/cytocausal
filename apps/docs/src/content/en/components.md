---
title: "Components"
---

# Components

`CausalWorkspace` gives you a complete interface in one line. Every part of it is also a component you can use on its own.

## The whole interface

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { CausalWorkspace } from "@cytocausal/react";

export function App({ dataset }: { dataset: CausalDataset }) {
  return <CausalWorkspace dataset={dataset} title="My graph" />;
}
```

Import the styles once, in your root layout:

```tsx
import "@cytocausal/react/styles.css";
```

| Prop | Default | What it does |
| :--- | :--- | :--- |
| `dataset` | Required | The graph to show |
| `title` | None | Text at the top of the sidebar |
| `labels` | English | Text to replace |
| `themes` | `lightTheme`, `darkTheme` | The light and dark [themes](/en/theming/) |
| `styleOptions` | None | Options for `createCausalStyle` |
| `layout` | Automatic | Saved positions if every node has one, or else an automatic layout |
| `maxSelected` | `2` | How many nodes can be selected. Selecting two lists the paths between them |
| `shareInUrl` | `true` | Keeps the version and selection in the page address, so a link reopens the same view |
| `children` | None | Extra panels at the end of the sidebar |

Define `labels`, `themes` and `styleOptions` outside your component, so they stay the same between renders.

On graphs of more than 60 nodes, the workspace only lists loops of up to six nodes, because the full list can be enormous. A `+` after the count means there may be more.

## Choose your own parts

| Component | What it shows |
| :--- | :--- |
| `GraphView` | One graph |
| `CompareView` | Two snapshots side by side, with matching nodes aligned |
| `NodeSearch` | Search box and results |
| `NodeDetails` | A node's causes, effects, loops and evidence |
| `LoopList` | Feedback loops, marked reinforcing or balancing |
| `VersionSwitcher` | Buttons for moving between snapshots |
| `Legend` | A colour key |
| `ZoomControls` | Zoom and fit buttons |
| `NodeTooltip` | A hover preview, for `renderTooltip` |

Connect them with [`useCausalGraph`](/en/interactions/):

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { createCausalStyle, fcoseLayout, lightTheme, type Positions } from "@cytocausal/cytoscape";
import {
  CausalRoot,
  GraphView,
  Legend,
  NodeDetails,
  NodeSearch,
  useCausalGraph,
  ZoomControls,
} from "@cytocausal/react";
import { useRef } from "react";

const stylesheet = createCausalStyle(lightTheme);

export function MyApp({ dataset }: { dataset: CausalDataset }) {
  const [snapshot] = dataset.snapshots;
  const graph = useCausalGraph();
  const positionCache = useRef<Record<string, Positions>>({});

  return (
    <CausalRoot theme={lightTheme} className="cc-workspace">
      <div className="cc-graph">
        <GraphView
          dataset={dataset}
          snapshotId={snapshot.id}
          layout={fcoseLayout}
          stylesheet={stylesheet}
          positionCache={positionCache}
          onReady={graph.attach}
        />
        <ZoomControls graph={graph} />
      </div>
      <aside className="cc-sidebar">
        <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
        <Legend />
        {graph.selected.map((id) => (
          <NodeDetails
            key={id}
            snapshot={snapshot}
            nodeId={id}
            onSelect={graph.focus}
            onClose={() => graph.toggle(id)}
          />
        ))}
      </aside>
    </CausalRoot>
  );
}
```

`apps/explorer` and `apps/perspectiva` are built this way, each using the parts it needs.

## Paths, depth and changes

These three panels work with the same `useCausalGraph` hook:

```tsx
"use client";
import type { CausalDataset, Snapshot } from "@cytocausal/core";
import { DepthControl, PathList, useCausalGraph, VersionDiff } from "@cytocausal/react";

export function Panels({ dataset, snapshot }: { dataset: CausalDataset; snapshot: Snapshot }) {
  const graph = useCausalGraph({ maxSelected: 2 });
  const [from, to] = graph.selected;

  return (
    <>
      <DepthControl value={graph.depth} onChange={graph.setDepth} />
      {to && (
        <PathList
          snapshot={snapshot}
          from={from}
          to={to}
          active={graph.activeLoop}
          onToggle={graph.toggleLoop}
        />
      )}
      <VersionDiff dataset={dataset} from="V1" to="final" />
    </>
  );
}
```

`PathList` shows both directions, because A can lead to B without B leading to A. `VersionDiff` shows its **Show on graph** button when you pass `shown` and `onToggle`. Mark the changes yourself with `highlightChanges(cy, added, removed)`.

## Export the graph

`CausalWorkspace` has an **Export PNG** button. To add your own, call `exportImage` from `@cytocausal/cytoscape`:

```ts
import type { Core } from "cytoscape";
import { exportImage, lightTheme } from "@cytocausal/cytoscape";

export function download(cy: Core) {
  exportImage(cy, "my-graph", lightTheme.colors.background);
}
```

## Change the text

Every piece of text can be replaced, such as to translate the interface:

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { CausalWorkspace, type CausalLabels } from "@cytocausal/react";

const labels: Partial<CausalLabels> = {
  search: "搜索节点…",
  matches: (count) => `${count} 个结果`,
  causedBy: "原因",
  leadsTo: "结果",
};

export function App({ dataset }: { dataset: CausalDataset }) {
  return <CausalWorkspace dataset={dataset} labels={labels} />;
}
```

If you aren't using `CausalWorkspace`, wrap your components in `CausalLabelsProvider`.

## Style the components

Components use `cc-*` classes and the theme's `--cc-*` variables, so you don't need Tailwind. Most accept a `className`. To restyle one, override its class in your own CSS.
