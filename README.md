# cytocausal

A Next.js and Cytoscape.js interface for exploring causal graphs. It provides the data model, causal analysis, stable layouts, version transitions and React views.

| Path | Contents |
| --- | --- |
| `packages/core` | Schema, validation and analysis, with no UI dependencies |
| `packages/cytoscape` | Layouts, anchoring, transitions and highlighting |
| `packages/react` | Graph views, search and the evidence panel |
| `apps/docs` | Cytoscape.js tutorials and framework guides, built with Nextra |

Perspectiva and Causal Explorer will become the two demo apps under `apps/`, both on Next.js. See [the plan](docs/PLAN.md).

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
