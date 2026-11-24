---
title: "Getting started"
---

# Getting started

Build a causal graph interface from a dataset, then add the panels and interactions your application needs. `CausalWorkspace` supplies a complete viewer; `CausalProvider` lets you compose the pieces, and `CausalEditor` supplies authoring controls.

This guide uses the source workspace. You need Node.js 22.18 or later.

## Run the starter

```sh
git clone https://github.com/SonghaiFan/cytocausal.git
cd cytocausal
npm install
npm run dev
```

Open `http://localhost:3102` for a fictional coffee-shop model with two versions. Open `http://localhost:3102/editor` for the editable example.

## Replace the model

Edit `apps/starter/src/data.ts`. A dataset contains snapshots; each snapshot has nodes and edges. Edges refer to node IDs, and can carry a positive or negative polarity.

```ts
import type { CausalDataset } from "@cytocausal/core";

export const dataset: CausalDataset = {
  id: "my-graph",
  snapshots: [
    {
      id: "final",
      nodes: [
        { id: "rain", label: "Rain" },
        { id: "floods", label: "Floods" },
      ],
      edges: [{ id: "rain-floods", source: "rain", target: "floods", polarity: "positive" }],
    },
  ],
};
```

`CausalWorkspace` displays validation issues in its sidebar. For CSV, spreadsheets and existing JSON, follow [Bring your own data](/en/import-data/).

## Choose an interface

Edit `apps/starter/src/components/App.tsx` to change the viewer.

| What you need | Start with | Read next |
| --- | --- | --- |
| A graph with search, details and analysis panels | `CausalWorkspace` | [Compose an interface](/en/components/) |
| Your own arrangement of graph and panels | `CausalProvider` and `CausalGraph` | [Compose panels](/en/example-compose/) |
| Node and relationship editing | `CausalEditor` | [Editable graph](/en/components/#an-editable-graph) |
| A specialised renderer integration | `GraphView` | [React lifecycle](/en/react-lifecycle/) |

Keep the starter's browser-only loading boundary and give the graph container a height. Import `@cytocausal/react/styles.css` once; the editor also uses `@cytocausal/react/editor.css`.

Use [document commands](/en/commands/) for application-driven edits, undo/redo and shared selection.

## Continue with your task

- **Build the interface:** [styles](/en/theming/) and [interactions](/en/interactions/).
- **Describe and analyse the model:** [data model](/en/data-model/), [evidence](/en/provenance/) and [causal analysis](/en/causal-analysis/).
- **Compare versions:** [stable layouts](/en/stable-layouts/) and [version transitions](/en/version-transitions/).
- **Start from runnable code:** [choose an example](/en/examples/).

The separate [Cytoscape.js course](/en/cytoscape-basics/) teaches native graph APIs with standalone React and vanilla demos. You do not need to complete it before using Cytocausal. When adding native behaviour to the framework, use [Extend with Cytoscape.js](/en/cytoscape-integration/).

Repository setup and contribution details are in [CONTRIBUTING.md](https://github.com/SonghaiFan/cytocausal/blob/main/CONTRIBUTING.md). Check [DATA.md](https://github.com/SonghaiFan/cytocausal/blob/main/DATA.md) before reusing the application datasets.
