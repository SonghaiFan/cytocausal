# cytocausal

A Next.js and Cytoscape.js interface for exploring causal graphs. It provides the data model, causal analysis, stable layouts, version transitions and React views.

| Path | Contents |
| --- | --- |
| `packages/core` | Schema, validation and analysis, with no UI dependencies |
| `packages/cytoscape` | Layouts, anchoring, transitions and highlighting |
| `packages/react` | Graph views, search and the evidence panel |
| `apps/docs` | Cytoscape.js tutorials and framework guides, built with Nextra |
| `apps/perspectiva` | Compares versions of causal loop diagrams |

Perspectiva is the first demo app, and Causal Explorer will follow. See [the plan](docs/PLAN.md).

## Run locally

Use Node.js 22.18 or later.

```sh
npm install
npm run dev
npm run dev:perspectiva
```

Before committing, run:

```sh
npm test
npm run test:e2e
npm run typecheck
npm run check:content
npm run build
```

`npm run test:e2e` needs Chrome and a production build of Perspectiva. `npm test` also checks results against the real Perspectiva and Causal Explorer datasets when they are on disk. Those datasets aren't in this repo, so set `CYTOCAUSAL_PERSPECTIVA` and `CYTOCAUSAL_EXPLORER` to their project folders, or those tests are skipped.

## License

[MIT](LICENSE)
