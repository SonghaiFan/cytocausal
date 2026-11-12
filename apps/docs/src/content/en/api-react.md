---
title: "React API"
---

# React API

This reference covers the primary integration APIs in the current source workspace. Packages are not yet published to npm. The linked TypeScript source is the authority for additional exports.

`import { … } from "@cytocausal/react"`

Import `@cytocausal/react/styles.css` once. Current package peer dependency: React 19. Graph views require a browser and a sized container; keep the starter’s client-only loading boundary.

## CausalWorkspace / CausalProvider

`CausalWorkspace` composes a graph and sidebar. It inherits provider props except `children` and `className`, then adds `title`, extra sidebar `children`, `depthControl` (false) and `showDirections` for debugging. `CausalProvider` shares state with your own child components and accepts `className`.

| Prop | Default and contract |
| --- | --- |
| `dataset` | Required; at least one snapshot |
| `initialVersion` | First snapshot |
| `initialSelected`, `initialLink` | No selection; link overrides nodes |
| `maxSelected` | `Infinity` |
| `initialBaseline` | `"previous"`; `"first"` / snapshot id |
| `shareInUrl` | Workspace `true`; Provider `false` |
| `layout` | Saved positions if all nodes have them, otherwise automatic |
| `layouts`, `initialLayout` | Named layouts replace `layout`; first name by default |
| `themes`, `scheme` | Default light/dark themes; system scheme unless set |
| `labels` | `Partial<CausalLabels>` |
| `styleOptions` | `CausalStyleOptions` |
| `graphOptions` | `readableLabels`, `focusZoom`, `maxDepth`, `defaultDepth` |
| `loopOptions` | Initial maxLength 4, limit 1000 unless loopSettings supplied |
| `loopSettings` | `{ title, description, maxLength, limit }` |

Initial props seed state; they are not controlled values. Keep configuration objects stable across renders. `shareInUrl` reads and writes view state in the current address; turn it off for embedded examples. To switch an entire loaded dataset, remount with a new key.

## useCausal

```tsx
const { snapshot, version, setVersion, graph, exportImage } = useCausal();
```

Call inside `CausalProvider`. `setVersion(id, { focus })` can preserve a focused node/link as versions change. `graph` exposes selection and navigation; `exportImage()` downloads the graph. Other state includes `dataset`, `issues`, `scheme`, `theme`, `baseline`, contributor filtering, `showChanges` and URL sharing. Consult the inferred `CausalState` type for the complete surface.

## Composition components

| Component | Purpose |
| --- | --- |
| `CausalGraph` | Provider-connected graph; radial menu and zoom controls |
| `NodeSearch`, `SelectionPanel` | Find nodes; read selection details and paths |
| `NodeDetails`, `LinkDetails` | Inspect nodes, links and evidence |
| `VersionSwitcher`, `VersionTimeline`, `VersionDiff` | Navigate versions and inspect changes |
| `ContributorFilter` | Filter attributed content |
| `CyclePanel`, `LoopList`, `PathList` | Cycle controls and route results |
| `Legend`, `DepthControl`, `LayoutSwitcher`, `ZoomControls` | Graph controls |

[Complete composition example](/en/example-compose/) · [Component guide](/en/components/)

## GraphView / useCausalGraph

```tsx
const graph = useCausalGraph();
<GraphView dataset={dataset} snapshotId="draft" onReady={graph.attach} />
```

`GraphView` requires `dataset` and `snapshotId`; it owns the Cytoscape instance lifecycle. `onReady` receives each new instance. `useCausalGraph` owns interaction state and can be used without a provider. Connect `attach` to `onReady`.

| GraphView prop | Default / type |
| --- | --- |
| `layout` | `autoLayout`; stable object |
| `stylesheet` | `createCausalStyle(lightTheme)` |
| `maxZoom` | `2` |
| `animateSnapshots`, `animateLayouts` | `false` |
| `positionCache` | `RefObject<Record<string, Positions>>` |
| `anchorPositions` | `Positions` |
| `onLayoutComplete` | `(positions: Positions) => void` |
| `renderTooltip`, `renderLinkTooltip` | Custom previews |
| `tooltipDelay` | `300` ms |

Hook options: `maxSelected` defaults to unlimited, `selectable` to true, `maxDepth` to 2 and `defaultDepth` to 1. `focusZoom` is optional; without it focusing does not change zoom. Use the returned `focus`, `selected`, `selectedLink`, `clear` and route controls to wire your interface.

## CompareView

```tsx
<CompareView dataset={dataset} left="draft" right="reviewed" />
```

Requires both snapshot ids. Matches nodes with `followNodes`, aligns the right graph to the left and synchronises view movement by default (`sync=true`). `format(id)` labels the panes; `onReady(cy, snapshotId)` exposes instances. Also accepts shared layout, stylesheet, motion, maxZoom and positionCache props.

[CausalProvider.tsx](https://github.com/SonghaiFan/cytocausal/blob/main/packages/react/src/CausalProvider.tsx) · [GraphView.tsx](https://github.com/SonghaiFan/cytocausal/blob/main/packages/react/src/GraphView.tsx) · [CompareView.tsx](https://github.com/SonghaiFan/cytocausal/blob/main/packages/react/src/CompareView.tsx)

## CausalEditor

A browser-only Author / Explore editor. Import `@cytocausal/react/editor.css` alongside shared styles. Give its host a height (for example 720px); desktop minimum height is 560px.

| Prop | Contract |
| --- | --- |
| `initialDataset` | Required; validated and cloned once. At least one snapshot. Later prop changes are ignored. |
| `onChange(dataset)` | Detached document after edits, undo or redo. No initial, selection-only, mode-only or snapshot-navigation notification. No persistence. |
| `initialNodeStyle` | `"text"` (default) or `"dot"`; initial value only. |
| `onNodeStyleChange(style)` | Appearance preference callback; not a document edit. |
| `header(api)`, `toolbar(api)` | Render host controls with the current `CausalEditorApi`. |
| `footer`, `className` | Optional React content and editor surface class. |
| `ref` | React 19 ref exposing `CausalEditorApi`. |

The API exposes:

- `getDataset()`: detached copy including authored positions.
- `replaceDataset(dataset)`: validate, cancel pending gestures and replace as one undoable edit. Emits `onChange` and selects the first snapshot.
- `replaceDataset(dataset, { resetHistory: true })`: start a new session, clearing pending edits, selection, camera and history. Retains node style. No `onChange` notification: the host already owns the loaded data. Invalid input throws before replacement.
- `renameDataset(name)`: commit a trimmed, nonempty name.
- `undo()`, `redo()`, `canUndo`, `canRedo`: document history available in Author mode. Up to 50 committed undo steps; a new edit clears redo.

Selection, camera and history belong to each mounted editor. Switching modes preserves selection and camera; temporary Explore positions are restored to authored positions on return. History is not persisted. Do not call `replaceDataset` for every `onChange` echo: update host state or save externally without resetting the session.
