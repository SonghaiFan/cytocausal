# cytocausal

A framework for exploring causal graphs with Cytoscape.js. It covers the shared data model, causal analysis, stable layouts, version transitions and the React views.

| Path | Contents |
| --- | --- |
| `packages/core` | Schema, validation and analysis, with no UI dependencies |
| `packages/cytoscape` | Layouts, anchoring, transitions and highlighting |
| `packages/react` | Graph views, search and the evidence panel |
| `apps/docs` | Cytoscape.js tutorials and framework guides |

Perspectiva and Causal Explorer will become the two demo apps under `apps/`. See [the plan](docs/PLAN.md).

## Run locally

Use Node.js 22.12 or later.

```sh
npm install
npm run dev
```

Before committing, run:

```sh
npm run typecheck
npm run check:content
npm run build
```
