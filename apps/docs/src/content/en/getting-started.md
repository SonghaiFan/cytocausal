---
title: "Getting started"
---

# Getting started

You need Node.js 22.18 or later.

```sh
git clone https://github.com/SonghaiFan/cytocausal.git
cd cytocausal
npm install
npm run dev
```

Open `http://localhost:3102`. You'll see a small made-up model of a coffee shop, with two versions and its feedback loops listed.

## Make it yours

Everything you need to change is in `apps/starter/src`:

| File | What it does |
| :--- | :--- |
| `data.ts` | Your graph. Start by replacing this |
| `graph-style.ts` | How nodes and links look |
| `components/App.tsx` | The page: graph, search, version buttons and loop list |

To keep the starter as a reference, copy `apps/starter` to `apps/your-app` and change `name` in its `package.json`.

## Add your data

Your data needs to fit the [data model](/en/data-model/). Only ids and labels are required, so a graph can be as simple as:

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

The starter shows any problems `validateDataset` finds at the top of the sidebar.

## What's in the repo

| Path | Contents |
| :--- | :--- |
| `apps/starter` | The app to build from |
| `apps/perspectiva` | Example: comparing versions side by side |
| `apps/explorer` | Example: exploring a large network |
| `apps/docs` | This site |
| `packages/core` | Data model, validation and analysis |
| `packages/cytoscape` | Layouts, transitions and highlighting |
| `packages/react` | `GraphView`, `CompareView` and `NodeSearch` |

Run the examples with `npm run dev:perspectiva` and `npm run dev:explorer`.

## Contribute

See [CONTRIBUTING.md](https://github.com/SonghaiFan/cytocausal/blob/main/CONTRIBUTING.md). The datasets in this repo have their own terms, so read [DATA.md](https://github.com/SonghaiFan/cytocausal/blob/main/DATA.md) before reusing them.
