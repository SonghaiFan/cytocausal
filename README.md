# cytocausal

A toolkit for building causal graph interfaces that can be traced and compared, for research on participatory modelling and causal extraction from text. It's a Next.js and React starter: clone it, swap in your data, and build your own interface.

- **Traceable**: every node and link keeps who stated it and on what grounds, so any part of the graph can be checked against its source.
- **Comparable**: versions are matched node by node, even through renames and merges. Several people's graphs combine into one that shows where they agree.
- **Analysed along cause and effect**: feedback loops marked reinforcing or balancing, causal paths, and directed centrality, with no dependencies in `core`.

## Quick start

Use Node.js 22.18 or later.

```sh
git clone https://github.com/SonghaiFan/cytocausal.git
cd cytocausal
npm install
npm run dev
```

Open `http://localhost:3102`, then edit `apps/starter/src/data.ts` to use your own graph.

## What's included

| Path | Contents |
| --- | --- |
| `apps/starter` | The app to build from |
| `apps/perspectiva` | Example: compares versions of causal loop diagrams |
| `apps/explorer` | Example: explores a large causal network |
| `apps/docs` | Guides, in English and Chinese |
| `packages/core` | Data model, provenance, validation and analysis, with no dependencies |
| `packages/cytoscape` | Themes, styles, layouts, transitions and highlighting |
| `packages/react` | `CausalWorkspace`, its components and `useCausalGraph` |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the starter |
| `npm run dev:docs` | Runs the guides |
| `npm run dev:perspectiva` | Runs the Perspectiva example |
| `npm run dev:explorer` | Runs the Explorer example |
| `npm test` | Runs unit tests |
| `npm run typecheck` | Checks types |
| `npm run build` | Builds everything |
| `npm run test:e2e` | Runs browser tests, after a build. Needs Chrome |

The docs link to the example apps, and the apps link back. These default to the local servers. For deployed sites, set `NEXT_PUBLIC_PERSPECTIVA_URL` and `NEXT_PUBLIC_EXPLORER_URL` on the docs, and `NEXT_PUBLIC_DOCS_URL` on the apps.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The code and documentation are under the [MIT license](LICENSE). The datasets and logo are not: see [DATA.md](DATA.md).
