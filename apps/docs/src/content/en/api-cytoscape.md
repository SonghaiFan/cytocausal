---
title: "Cytoscape API"
---

# Cytoscape API

This reference covers the primary integration APIs in the current source workspace. Packages are not yet published to npm. The linked TypeScript source is the authority for additional exports.

`import { … } from "@cytocausal/cytoscape"`

This package integrates with Cytoscape.js; it is not a fork. Use it when building your own renderer lifecycle or custom graph behaviour. React consumers normally start with the higher-level components.

## toElements

```ts
toElements(snapshot: Snapshot): { nodes: ElementDefinition[]; edges: ElementDefinition[] }
```

Maps nodes and edges into Cytoscape elements. Copies metadata, then sets canonical identity fields. Adds `support` and `supportShare` from evidence, and `+` / `-` edge labels for known polarity. Evidence itself stays in the source dataset.

## createCausalStyle

```ts
createCausalStyle(theme: CausalTheme, options?: CausalStyleOptions): Stylesheet[]
```

| Option | Values / behaviour |
| --- | --- |
| `node` | `"dot" \| "pill"` |
| `link` | `"bezier" \| "flowing" \| "straight"` |
| `sizeByScore` | Uses score data in 0–1 range |
| `weightBySupport` | Weights edges by supportShare |
| `managedLabels` | Shows labels marked by the label manager |
| `zoom` | `"magnify" \| "balanced" \| "spread"` |
| `baseRules` | App rules precede interaction-state rules |

The default zoom mode is spread with managed labels and magnify otherwise. Spread/balanced require the constant-size helper; `keepLabelsReadable` enables it. Use the React integration or follow the theming guide when configuring this directly.

## Themes and layouts

`lightTheme`, `darkTheme` are `CausalTheme` objects. Use `themeVariables(theme)` to obtain the UI CSS variables. Keep graph semantics independent of brand colours.

| Export | Purpose |
| --- | --- |
| `autoLayout` | Default automatic layout configuration |
| `savedLayout` | `preset`, `fit: true`, `padding: 30` |
| `layouts` | cola, fcose, dagre, breadthfirst, concentric, cose, circle, grid, random |
| `Positions` | `Record<string, {x: number, y: number}>` |
| `alignPositions(positions, counterparts)` | Aligns counterparts; merges use centre positions |
| `snapshotPositions(cy, snapshot)` | Reads current positions for snapshot nodes |
| `relayout(cy, layout, options?)` | Relayout with optional positions, motion, onSettled |

## Highlights and view controls

| Call | Behaviour |
| --- | --- |
| `highlightCausalNeighbours(cy, ids, depth = 1)` | Marks causes, effects and focus; empty ids clear |
| `highlightRoute(cy, route)` | `route: {nodes: string[], edges: string[]} \| null` |
| `highlightChanges(cy, marks)` | `Partial<ChangeMarks>`; empty object clears |
| `hideExceptContributors(cy, snapshot, names)` | `string[] \| null`; null = everyone |
| `focusNode(cy, id, options?)` | Default zoom 2; optional motion |
| `fitNodes(cy, duration = 0)` | Fits node bounds |
| `zoomBy(cy, factor, duration = 0)` | Relative zoom |
| `exportImage(cy, fileName, background)` | Downloads a PNG in the browser |

These functions update Cytoscape styles/classes or view state. Avoid having competing interaction handlers overwrite each other. The React hook coordinates those states for you.

## transitionToSnapshot

```ts
transitionToSnapshot(cy, snapshot, {
  counterparts, // Record<string, string[]>
  positions,    // optional Positions
  motion,       // optional CausalMotion
  onSettled,    // required () => void
})
```

Transitions an existing instance to a snapshot. Compute `counterparts` using core’s `followNodes`. Existing corresponding nodes travel, new ones fade in and removed ones fade out. Without target positions, matched nodes stay anchored while fcose places others. React `GraphView` can manage this with `animateSnapshots`.

[style.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/cytoscape/src/style.ts) · [transition.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/cytoscape/src/transition.ts) · [Theming guide](/en/theming/) · [Layout guide](/en/stable-layouts/)
