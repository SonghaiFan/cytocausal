---
title: "Examples"
---

# Examples

Choose a Cytocausal example for your application task, or a standalone Cytoscape.js demo for learning native graph APIs.

## Build with Cytocausal

These examples share a fictional garden dataset and demonstrate framework components and data analysis. Each page includes a live example and its source.

| Task | Example | Related guide |
| --- | --- | --- |
| Start a complete interface from a dataset | [Complete workspace](/en/example-workspace/) | [Getting started](/en/getting-started/) |
| Arrange the graph and sidebar yourself | [Compose panels](/en/example-compose/) | [Compose an interface](/en/components/) |
| Compare a renamed node across snapshots | [Compare versions](/en/example-versions/) | [Stable layouts](/en/stable-layouts/) |
| Query paths and loops without a renderer | [Analysis without a renderer](/en/example-analysis/) | [Causal analysis](/en/causal-analysis/) |

Run `npm run dev:docs` in the source workspace, or copy an example with `data.ts` and `garden.json` into the starter. The component implementations live in `apps/docs/src/components/examples/` and use the workspace dependencies.

## Learn native Cytoscape.js

Each native demo has its own page and chapter navigation. Use Preview to interact with the graph, then Code to load an actual source file. Select files, copy the code or open a source file directly. Switching Preview and Code preserves graph state.

| Topic | Tutorial | Standalone demos |
| --- | --- | --- |
| Setup and initialisation | [Read guide](/en/cytoscape-basics/setup/) | [Vanilla JavaScript](/examples/en/vanilla/setup/) · [React](/examples/en/react/setup/) |
| Nodes and edges | [Read guide](/en/cytoscape-basics/elements/) | [Vanilla JavaScript](/examples/en/vanilla/elements/) · [React](/examples/en/react/elements/) |
| Layouts and viewport | [Read guide](/en/cytoscape-basics/layouts/) | [Vanilla JavaScript](/examples/en/vanilla/layouts/) · [React](/examples/en/react/layouts/) |
| Styles and animation | [Read guide](/en/cytoscape-basics/styles/) | [Vanilla JavaScript](/examples/en/vanilla/styles/) · [React](/examples/en/react/styles/) |
| Interactions and events | [Read guide](/en/cytoscape-basics/events/) | [Vanilla JavaScript](/examples/en/vanilla/events/) · [React](/examples/en/react/events/) |
| Graph algorithms | [Read guide](/en/cytoscape-basics/algorithms/) | [Vanilla JavaScript](/examples/en/vanilla/algorithms/) · [React](/examples/en/react/algorithms/) |
| Import and export | [Read guide](/en/cytoscape-basics/data/) | [Vanilla JavaScript](/examples/en/vanilla/data/) · [React](/examples/en/react/data/) |

The native demos teach the underlying APIs. To apply them inside the causal graph components, read [Extend with Cytoscape.js](/en/cytoscape-integration/).
