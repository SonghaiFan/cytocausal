<p><img src="apps/docs/public/brand/mark.svg" width="72" height="72" alt="Causal sunburst icon" /> <picture><source media="(prefers-color-scheme: dark)" srcset="apps/docs/public/brand/wordmark-dark.svg" /><img src="apps/docs/public/brand/wordmark.svg" width="276" height="60" alt="cytocausal" /></picture></p>

# cytocausal

**A React library for causal graph interfaces, built on Cytoscape.js.**

Build React interfaces where people can explore causes and effects, trace the evidence behind a relationship, and compare how a model changes. Use the complete workspace or compose your own interface from its components.

[Documentation](https://songhaifan.github.io/cytocausal/en/) · [Showcase](https://songhaifan.github.io/cytocausal/en/showcase/) · [Draw a graph](https://cytocausal-studio.vercel.app) · [中文文档](https://songhaifan.github.io/cytocausal/zh-cn/)

![Perspectiva uses cytocausal to compare versions of a causal graph](apps/docs/public/images/perspectiva-compare.png)

## Built for causal graphs

- **Trace evidence.** Keep sources and contributors attached to nodes and links. Inspect agreement and differences between people's models.
- **Compare versions.** Follow nodes across renames, merges and splits using explicit correspondences, stable layouts and animated transitions.
- **Explore cause and effect.** Navigate upstream and downstream, find directed paths, and inspect feedback loops, classified as reinforcing or balancing when polarity is known.

cytocausal adds causal semantics, UX and APIs on top of Cytoscape.js. It uses the relationships supplied in your data; displaying and analysing a graph does not establish that those relationships are causal.

## From library to application

There are two application paths:

- **Your own project — available now.** Start with the React / Next.js starter, replace its data and compose the interface you need.
- **Online drawing — Studio.** Add nodes and directed links, edit labels and polarity, then explore the graph. Work is saved in your browser, with JSON import/export for backups. No account or cloud synchronisation.

Start with `@cytocausal/react`: use the complete workspace or compose components. Cytoscape.js supplies the graph engine; cytocausal supplies causal semantics, analysis and React interactions. Next.js is used by the starter and applications, rather than being the library’s required UI framework.

For authoring, use `CausalEditor`: edit rings, inline naming, cause/effect connections, polarity, and undo/redo with an `onChange` callback. Studio uses this same component and adds local saving and file operations. The minimal host example is at `apps/starter/src/components/EditorExample.tsx`; run the starter and open `/editor`. Import both `@cytocausal/react/styles.css` and `@cytocausal/react/editor.css`.

The implementation is organised into three packages:

| Package | Responsibility |
| --- | --- |
| `@cytocausal/core` | Renderer-independent data model, provenance, validation, versions and causal analysis; no runtime dependencies |
| `@cytocausal/cytoscape` | Cytoscape.js integration: causal styles, layouts, transitions and highlighting |
| `@cytocausal/react` | Complete `CausalWorkspace`, composable UI components and interaction hooks |

## A complete workspace

Inside the starter, a dataset becomes an interactive interface:

```tsx
"use client";

import type { CausalDataset } from "@cytocausal/core";
import { CausalWorkspace } from "@cytocausal/react";
import "@cytocausal/react/styles.css";

export function App({ dataset }: { dataset: CausalDataset }) {
  return <CausalWorkspace dataset={dataset} title="My causal graph" />;
}
```

Use `CausalProvider`, `CausalGraph` and individual panels when you want to assemble your own layout. See the [component guide](apps/docs/src/content/en/components.md).

## Get started

Use Node.js 22.18 or later. Packages currently live in this source workspace and are marked private; there is no published npm installation workflow yet.

```sh
git clone https://github.com/SonghaiFan/cytocausal.git
cd cytocausal
npm install
npm run dev
```

Open `http://localhost:3102`. Replace the fictional coffee shop model in `apps/starter/src/data.ts`, then customise `apps/starter/src/components/App.tsx`.

To browse the homepage, live showcase and bilingual guides:

```sh
npm run dev:docs
```

Open `http://localhost:3200/en/` or `http://localhost:3200/zh-cn/`.

## See it in use

| Application | What it demonstrates | Run locally |
| --- | --- | --- |
| [Perspectiva](apps/docs/src/content/en/case-perspectiva.mdx) | Comparing causal loop diagrams from participatory workshops, tracing terms and combining perspectives | `npm run dev:perspectiva` → port 3100 |
| [Causal Explorer](apps/docs/src/content/en/case-explorer.mdx) | Searching an event network, reading source descriptions and exploring causes, effects and loops | `npm run dev:explorer` → port 3101 |

The [showcase](apps/docs/src/content/en/showcase.mdx) uses a small fictional dataset to demonstrate the workspace, styles, comparison and individual panels. Run the docs site to interact with it.

## Examples and API

- [Bring your own data](apps/docs/src/content/en/import-data.mdx): parse, validate, render, attach evidence and compare versions.
- [Independent examples](apps/docs/src/content/en/examples.md): complete runnable source for workspace, composition, comparison and analysis.
- API reference: [Core](apps/docs/src/content/en/api-core.md) · [React](apps/docs/src/content/en/api-react.md) · [Cytoscape](apps/docs/src/content/en/api-cytoscape.md).
- [Visual identity](apps/docs/src/content/en/brand.md): the yellow causal sunburst and reusable brand assets.

## Development and status

The library, starter and examples are under active development. Studio is an initial browser-local editor; standalone package distribution remains future work. See [the project plan](docs/PLAN.md).

| Command | Purpose |
| --- | --- |
| `npm test` | Unit tests |
| `npm run typecheck` | Type checks |
| `npm run check:content` | Documentation content checks |
| `npm run build` | Build all apps |
| `npm run test:e2e` | Browser tests after a build; requires Chrome |

For deployed apps, set `NEXT_PUBLIC_STUDIO_URL`, `NEXT_PUBLIC_PERSPECTIVA_URL` and `NEXT_PUBLIC_EXPLORER_URL` on the docs, and `NEXT_PUBLIC_DOCS_URL` on the apps. Otherwise launch links use local servers. See the [deployment guide](docs/deployment/README.md) for GitHub Pages and the three Vercel projects.

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code and documentation use the [MIT license](LICENSE). Datasets and the logo have separate terms: see [DATA.md](DATA.md).
