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
| `layouts`, `initialLayout` | None, the first | Named layouts to choose between, in place of `layout`. The workspace shows a switch, and a shared link keeps the choice |
| `maxSelected` | `2` | How many nodes can be selected. A click selects one; ⤳ in the radial menu adds a second and lists the paths between them |
| `scheme` | System | Sets `light` or `dark`, and hides the switch button |
| `initialVersion`, `initialSelected` | First snapshot, none | Where to start |
| `shareInUrl` | `true` | Keeps the version and selection in the page address, so a link reopens the same view |
| `children` | None | Extra panels at the end of the sidebar |

Define `labels`, `themes` and `styleOptions` outside your component, so they stay the same between renders.

On graphs of more than 60 nodes, the workspace only lists loops of up to six nodes, because the full list can be enormous. A `+` after the count means there may be more. Pass `loopOptions`, such as `{ maxLength: 8, limit: 200 }`, to set your own limits.

## Choose your own parts

Put the parts you want inside a `CausalProvider`. It holds the dataset, version, selection and theme, and each part connects itself, so none of them needs props:

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import {
  CausalGraph,
  CausalProvider,
  LoopList,
  NodeSearch,
  SelectionPanel,
  VersionSwitcher,
} from "@cytocausal/react";

export function MyApp({ dataset }: { dataset: CausalDataset }) {
  return (
    <CausalProvider dataset={dataset} className="cc-workspace">
      <CausalGraph />
      <aside className="cc-sidebar">
        <NodeSearch />
        <VersionSwitcher />
        <SelectionPanel />
        <LoopList />
      </aside>
    </CausalProvider>
  );
}
```

| Component | What it shows |
| :--- | :--- |
| `CausalGraph` | The graph, with zoom buttons. Children sit on top of it |
| `NodeSearch` | Search box and results |
| `VersionSwitcher` | Buttons for moving between snapshots |
| `LayoutSwitcher` | A choice of the provider's `layouts`, as buttons, or a menu for more than four |
| `RadialMenu` | A ring menu around the selected node, for walking to linked nodes, setting the steps and choosing loops. `CausalGraph` shows it unless `radialMenu={false}` |
| `SelectionPanel` | A prompt, then the selected nodes and the paths between them |
| `NodeDetails` | One node's causes, effects and evidence, with a button to open each link |
| `LinkDetails` | Who stated a link and their evidence, with any link that disagrees on its polarity |
| `ContributorFilter` | Whose nodes and links are shown. It appears once a snapshot has two contributors |
| `PathList` | The paths between two nodes, in both directions |
| `LoopList` | Feedback loops, marked reinforcing or balancing |
| `VersionDiff` | What changed between two snapshots |
| `DepthControl` | How far a highlight reaches |
| `Legend` | A key to what the graph draws: swatches, outlines or glyphs |
| `ZoomControls` | Zoom and fit buttons |
| `Segmented` | One choice from a few options, as joined buttons |
| `SidebarHeader` | A title, subtitle, links and the light and dark switch |

Hovering a row in `LoopList` or `PathList` previews it on the graph. Clicking keeps it.

`VersionSwitcher`, `Legend` and `DepthControl` take `bare`, which leaves out the panel so they can sit on the graph.

`CausalGraph` shows who stated a link when it's hovered. Pass `renderLinkTooltip` to show something else. Nodes have no tooltip: their details are in `SelectionPanel`. Without a sidebar, pass `renderNodeInfo` to show a card beside the radial menu. Pass `styleOptions={{ weightBySupport: true }}` to draw links thicker the more people stated them, defined outside your component.

For large graphs, `CausalProvider` takes `graphOptions`, such as `{ readableLabels: true }`, and `CausalGraph` takes `maxZoom`. `SelectionPanel` takes `loopOptions` to list the loops through each node.

### Read the state

Call `useCausal` anywhere inside the provider:

```tsx
"use client";
import { useCausal } from "@cytocausal/react";

export function Summary() {
  const { snapshot, version, graph, exportImage } = useCausal();
  return (
    <button type="button" onClick={exportImage}>
      Export {version}: {snapshot.nodes.length} nodes, {graph.selected.length} selected
    </button>
  );
}
```

It also has `setVersion`, `loops`, `theme`, `scheme`, `toggleScheme`, `showChanges`, `setShowChanges` and `copyLink`.

### Without a provider

Every part also takes its data as props, which override the provider. Use this for a layout the provider doesn't fit, such as two graphs that each have their own selection. Connect them with [`useCausalGraph`](/en/interactions/):

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { GraphView, NodeSearch, useCausalGraph, ZoomControls } from "@cytocausal/react";

export function MyGraph({ dataset }: { dataset: CausalDataset }) {
  const [snapshot] = dataset.snapshots;
  const graph = useCausalGraph();

  return (
    <div className="cc-workspace">
      <div className="cc-graph">
        <GraphView dataset={dataset} snapshotId={snapshot.id} onReady={graph.attach} />
        <ZoomControls graph={graph} />
      </div>
      <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
    </div>
  );
}
```

`GraphView` only needs `dataset` and `snapshotId`. `layout`, `stylesheet` and `positionCache` have defaults. `apps/explorer` and `apps/perspectiva` are built this way.

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
