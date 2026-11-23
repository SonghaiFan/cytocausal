---
title: "Cytoscape.js basics and extensions"
---

# Cytoscape.js basics and extensions

This is optional background after [Getting started](/en/getting-started/). You can use `CausalWorkspace` without learning the underlying API. Read this when you want to understand selectors, customise styles, or add graph interactions.

Cytoscape.js is the graph rendering and interaction library underneath cytocausal. Its “syntax” consists of JavaScript objects, selectors and API calls. cytocausal adds a causal data model, provenance, version comparison, causal analysis and React components.

## One small model, two implementations

Both examples use the same illustrative model:

```text
Rain ──(+)──▶ Soil water ──(−)──▶ Plant water stress
```

Here, more rain increases soil water, and more soil water reduces plant water stress, with other conditions held fixed. These are supplied assumptions for the example, not causal findings established by rendering the graph. Positive and negative describe direction of influence, not good and bad outcomes. The node IDs, edges and polarities are identical in both implementations; the workspace adds its own styling and controls.

Run these examples inside the existing workspace described in Getting started; the cytocausal packages are not yet published to npm. In Next.js, load either graph component through the browser-only loader described in [React lifecycle](/en/react-lifecycle/).

## Native Cytoscape.js

This component owns its container, graph instance, styles and event listeners. The container needs a non-zero height. Cleanup destroys the instance when React unmounts it.

```tsx
"use client";

import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";

export function NativeGraph() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: [
        { data: { id: "rain", label: "Rain", category: "weather" } },
        { data: { id: "water", label: "Soil water" } },
        { data: { id: "stress", label: "Plant water stress" } },
        { data: { id: "rain-water", source: "rain", target: "water", polarity: "positive", label: "+" } },
        { data: { id: "water-stress", source: "water", target: "stress", polarity: "negative", label: "−" } },
      ],
      style: [
        { selector: "node", style: { label: "data(label)", "background-color": "#555" } },
        { selector: "edge", style: {
          label: "data(label)", "curve-style": "bezier",
          "target-arrow-shape": "triangle", "line-color": "#777", "target-arrow-color": "#777",
        } },
        { selector: 'edge[polarity = "negative"]', style: { "line-style": "dashed" } },
        { selector: 'node[category = "weather"]', style: { "border-width": 2, "border-color": "#777" } },
      ],
      layout: { name: "breadthfirst", directed: true, padding: 40 },
    });
    const onTap = (event: cytoscape.EventObject) => console.log(event.target.id());
    cy.on("tap", "node", onTap);
    return () => {
      cy.off("tap", "node", onTap);
      cy.destroy();
    };
  }, []);

  return <div ref={container} style={{ height: 420, width: "100%" }} />;
}
```

`cytoscape({...})` returns the graph instance, conventionally called `cy`. Each element has a `data` object. An edge references node IDs with `source` and `target`; these are not labels. IDs must be unique across nodes and edges. `polarity` is custom data here: the stylesheet explicitly gives negative links their dashed appearance.

## The same graph in cytocausal

Put the model in `data.ts`. Nodes and edges live in a snapshot, and a dataset can contain multiple snapshots for version comparison.

```ts
// data.ts
import type { CausalDataset } from "@cytocausal/core";

export const dataset: CausalDataset = {
  id: "plant-water",
  snapshots: [{
    id: "initial",
    nodes: [
      { id: "rain", label: "Rain", metadata: { category: "weather" } },
      { id: "water", label: "Soil water" },
      { id: "stress", label: "Plant water stress" },
    ],
    edges: [
      { id: "rain-water", source: "rain", target: "water", polarity: "positive" },
      { id: "water-stress", source: "water", target: "stress", polarity: "negative" },
    ],
  }],
};
```

```tsx
"use client";

import type { LayoutOptions } from "cytoscape";
import type { CausalStyleOptions } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { dataset } from "./data";

const layout: LayoutOptions = { name: "breadthfirst", directed: true, padding: 40 };
const styleOptions: CausalStyleOptions = {
  baseRules: [{
    selector: 'node[category = "weather"]',
    style: { "border-width": 2, "border-color": "#777" },
  }],
};

export function App() {
  return <CausalWorkspace dataset={dataset} title="Plant water" layout={layout} styleOptions={styleOptions} />;
}
```

`CausalWorkspace` manages the graph lifecycle and supplies selection, search, analysis panels and view controls. The causal stylesheet supplies polarity labels and line styles. `baseRules` adds the weather-node border before interaction-state rules, so built-in highlights can still take precedence. Keep configuration objects outside the component, or memoise them when they depend on props.

## How the data maps

| Native Cytoscape.js | cytocausal input |
| :--- | :--- |
| Node `data.id`, `data.label` | Node `id`, `label` |
| Edge `data.source`, `data.target` | Edge `source`, `target` |
| Custom edge `data.polarity` | Typed edge `polarity`: `positive` or `negative` |
| Node `data.category` | Node `metadata.category` |
| Element `position` | Node `position`, outside `metadata` |
| One elements collection | One snapshot inside `CausalDataset.snapshots` |

The public `toElements` helper performs the conversion when you need a lower-level integration:

```ts
import { toElements } from "@cytocausal/cytoscape";
import { dataset } from "./data";

const elements = toElements(dataset.snapshots[0]);
```

It returns `{ nodes, edges }`, accepted by Cytoscape's `elements` option. Metadata fields are copied into element `data`, which is why `node[category = "weather"]` works in both examples. Generated fields such as `id`, `label` and `support` take precedence over metadata of the same name; keep custom fields distinct. See [Data model](/en/data-model/) for provenance and other domain fields.

## Reading selectors and style rules

| Expression | Meaning |
| :--- | :--- |
| `node` / `edge` | All nodes / all edges |
| `#rain` | Element with ID `rain` |
| `node[category = "weather"]` | Nodes whose data field `category` equals `weather` |
| `edge[polarity = "negative"]` | Edges whose data field `polarity` equals `negative` |
| `node:selected` | Nodes in Cytoscape's native selected state |
| `data(label)` | Read the element's `label` field as a style value |

A rule pairs a `selector` with a `style` object. These resemble CSS, but target graph elements, not HTML. Use Cytoscape style properties such as `background-color` and `target-arrow-shape`; page CSS controls the surrounding interface. Do not assume native `:selected` represents all cytocausal selection and highlighting states. Use the library's interaction APIs for those states.

For fuller customisation, see [Themes and styles](/en/theming/), including `createCausalStyle(theme, { baseRules })` for a `GraphView` stylesheet.

## Layouts, collections and events

A layout computes node positions; it does not change the relationships in the model. The examples use the built-in `breadthfirst` layout with `directed: true`. The initialisation option starts that layout; calling `cy.layout(...)` later creates a layout that you start with `.run()`.

The following calls assume you already have a live `cy` instance:

```ts
const rain = cy.getElementById("rain");
const negativeLinks = cy.edges('[polarity = "negative"]');
console.log(rain.data("label"), negativeLinks.length);
cy.fit(cy.elements(), 40);
cy.layout({ name: "breadthfirst", directed: true }).run();
```

Queries return collections, including a zero-or-one-element collection for `getElementById`. `fit` changes the viewport. For arbitrary IDs, `getElementById(id)` avoids constructing and escaping an ID selector.

The native example's `cy.on("tap", "node", handler)` listens for taps on nodes; `event.target` is the tapped node. Remove listeners with the same handler when your integration no longer needs them.

## Native API tour

The rest of this page condenses a seven-part Cytoscape.js tutorial into the calls you are most likely to meet when extending cytocausal. Every snippet assumes a live `cy` instance, such as the one in the native example above or the instance `GraphView` passes to `onReady`. In a cytocausal app, use these calls for views, effects and read-only queries; keep model edits in the dataset, as explained in [Where to extend in React](#where-to-extend-in-react).

### Setup and initialisation

Install Cytoscape.js from npm (`npm install cytoscape`) or load it from a CDN in a plain HTML page. The container must have a non-zero size before you call `cytoscape({...})`. Options other than `container`, `elements`, `style` and `layout` that you will use most often:

| Option | Effect |
| :--- | :--- |
| `minZoom`, `maxZoom` | Bound the zoom level |
| `wheelSensitivity` | Scale mouse-wheel zoom; leave at the default unless users report problems |
| `boxSelectionEnabled` | Allow drag-to-select a region |
| `autoungrabify`, `autounselectify` | Stop users dragging or selecting nodes |
| `textureOnViewport`, `hideEdgesOnViewport` | Trade rendering quality for speed while panning and zooming large graphs |

See [Scale and performance](/en/scale-performance/) for how cytocausal configures large graphs.

### Elements and collections

```ts
cy.add({ group: "nodes", data: { id: "sun", label: "Sunlight" } });
cy.add([
  { group: "nodes", data: { id: "growth", label: "Growth" } },
  { group: "edges", data: { id: "sun-growth", source: "sun", target: "growth" } },
]);
cy.getElementById("sun").data("label", "Sunshine");
cy.$("#growth").position({ x: 200, y: 100 });
cy.remove(cy.$(":selected"));
cy.batch(() => {
  cy.nodes().forEach((node) => {
    node.data("visited", false);
  });
});
```

`cy.add` accepts one element or an array; add nodes before edges that reference them. `data(key, value)` writes and `data(key)` reads. Wrap many changes in `cy.batch` so the renderer redraws once.

Traversal methods return new collections and follow edge direction where it matters:

| Call | Returns |
| :--- | :--- |
| `node.outgoers()`, `node.incomers()` | Edges and nodes one step downstream / upstream |
| `node.successors()`, `node.predecessors()` | Everything reachable downstream / upstream |
| `node.neighborhood()` | Adjacent nodes and edges, ignoring direction |
| `a.union(b)`, `a.difference(b)`, `a.intersection(b)` | Set operations on collections |
| `eles.filter(fn)` or `eles.filter(selector)` | A subset |

For causal questions, prefer `causesOf`, `effectsOf` and `findCausalPaths` from `@cytocausal/core`: they work on the dataset and need no renderer.

### Layouts and the viewport

| Layout | Use it for |
| :--- | :--- |
| `preset` | Positions you already have, including saved positions |
| `grid`, `circle`, `concentric` | Quick overviews of small graphs |
| `breadthfirst` | Hierarchies and mostly acyclic causal chains (`directed: true`) |
| `cose` | Force-directed layout for general networks |

Extensions such as `cytoscape-dagre` and `cytoscape-fcose` register more layouts with `cytoscape.use(...)`.

```ts
const layout = cy.layout({ name: "cose", animate: true });
layout.one("layoutstop", () => cy.fit(undefined, 40));
layout.run();

cy.$("#rain").closedNeighborhood().layout({ name: "circle" }).run(); // lay out a subgraph only
cy.zoom({ level: 1.5, renderedPosition: { x: 200, y: 200 } });
cy.panBy({ x: 50, y: 0 });
cy.center(cy.$("#water"));
cy.animate({ fit: { eles: cy.$("#stress"), padding: 60 } }, { duration: 400 });
```

Listen for `layoutstop` before reading final positions. [Stable layouts](/en/stable-layouts/) explains how cytocausal keeps positions steady between updates.

### Styles, classes and animation

Prefer classes over writing style values onto individual elements. A class is matched by a `.name` selector, so the appearance stays in the stylesheet:

```ts
cy.style().selector(".highlighted").style({ "background-color": "#f5b800" }).update();
cy.$("#rain").addClass("highlighted");
cy.$("#rain").removeClass("highlighted");

cy.$("#water").animate(
  { style: { width: 60, height: 60 }, position: { x: 300, y: 120 } },
  { duration: 300, easing: "ease-in-out-cubic" },
);
```

Useful style properties include `shape` (`ellipse`, `round-rectangle`, `diamond` and others), `background-color`, `border-width`, `line-style` (`solid`, `dashed`, `dotted`), `curve-style` (`bezier`, `straight`, `taxi`) and `target-arrow-shape`. Calls to `ele.animate` queue per element; pass `{ queue: false }` to run animations in parallel, and call `ele.stop()` to cancel. In cytocausal, add rules through `styleOptions.baseRules` rather than replacing the stylesheet, so interaction states keep working; see [Themes and styles](/en/theming/).

### Events

```ts
const onOver = (event: cytoscape.EventObject) => event.target.addClass("hover");
cy.on("mouseover", "node", onOver);
cy.on("mouseout", "node", (event) => event.target.removeClass("hover"));
cy.one("tap", () => console.log("first tap anywhere"));
cy.on("dragfree", "node", (event) => console.log(event.target.position()));
cy.off("mouseover", "node", onOver);
```

| Event | Fires when |
| :--- | :--- |
| `tap`, `dbltap`, `cxttap` | Click or touch, double, and right-click or long press |
| `mouseover`, `mouseout` | The pointer enters or leaves an element |
| `grab`, `drag`, `free`, `dragfree` | A node is grabbed, moved and released |
| `select`, `unselect` | Native selection changes |
| `add`, `remove`, `data` | Elements change |
| `viewport`, `zoom`, `pan` | The view changes |

Pass a selector as the second argument to delegate to matching elements; without it, the listener receives events on the core too, where `event.target === cy`. cytocausal's own selection and highlighting are exposed through [Graph interactions](/en/interactions/).

### Graph algorithms

Cytoscape.js includes algorithms that run on any collection:

```ts
const eles = cy.elements();
const rank = eles.pageRank({});
const water = cy.$("#water");
const between = eles.betweennessCentrality({ directed: true });
const { pathTo, distanceTo } = eles.dijkstra({ root: "#rain", directed: true });
eles.bfs({ roots: "#rain", directed: true, visit: (node) => console.log(node.id()) });
const groups = eles.components();

console.log(rank.rank(cy.$("#stress")), water.indegree(false), water.outdegree(false), between.betweenness(water));
console.log(distanceTo(cy.$("#stress")), pathTo(cy.$("#stress")).map((ele) => ele.id()));
console.log(groups.length);
```

Pass `directed: true` whenever direction carries meaning, as it does in causal graphs. `dijkstra` and `aStar` accept a `weight` function for weighted edges. `analyzeSnapshot` in `@cytocausal/core` runs directed betweenness and feedback-loop detection for you; see [Causal analysis](/en/causal-analysis/).

### Import and export

```ts
const saved = cy.json();                    // elements, style, viewport and options
const elementJson = cy.elements().jsons();  // plain element objects
cy.json({ elements: elementJson });         // restore elements, matched by ID
const png = cy.png({ full: true, scale: 2, output: "blob" });
```

`cy.json()` captures renderer state, not a cytocausal dataset. To load spreadsheets, CSV or JSON into cytocausal, follow [Bring your own data](/en/import-data/); `toElements` covers the reverse direction.

## Where to extend in React

| Task | Preferred entry point |
| :--- | :--- |
| Change nodes, edges, metadata or versions | Update the dataset through React |
| Change appearance or layout | `styleOptions`, themes and layout props |
| Select nodes or explore causes and effects | [Components](/en/components/) and [Interactions](/en/interactions/) |
| Add a specialised native event or integration | `GraphView`'s `onReady`, with the current instance |

Direct `cy.add()`, `cy.remove()` and `element.data()` mutations do not update `CausalDataset` or React state. A later synchronisation or rebuild can overwrite them, while analysis still uses the dataset. Keep model edits in the dataset. Let the owning component destroy its instance; custom integrations should clean up their own listeners and account for replacement instances. See [React lifecycle](/en/react-lifecycle/) and [Stable layouts](/en/stable-layouts/).

For the complete native API, consult the official [elements](https://js.cytoscape.org/#notation/elements-json), [selectors](https://js.cytoscape.org/#selectors), [styles](https://js.cytoscape.org/#style), [events](https://js.cytoscape.org/#events) and [layouts](https://js.cytoscape.org/#layouts) reference. The workspace currently pins Cytoscape.js 3.31.0; check compatibility before adopting APIs from newer documentation.
