# Learning Cytoscape.js

One lightweight learning site combining the English/Chinese tutorials and vanilla JavaScript demos from `learning_cytospace` with the React playgrounds from `learning_cytoscape_react`.

Built with **Astro Starlight**. Documentation is generated as static HTML; only playground pages load React and Cytoscape. Optional layout extensions download on selection. The production output needs no Node.js server or paid documentation service. Search, code highlighting, chapter navigation, language switching, and light/dark themes are included.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS).

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro (normally `http://localhost:4321`).

```sh
npm run typecheck
npm run check:content
npm run build
npm run preview
```

Deploy `dist/` to any static host. Vanilla demos retain their original CDN dependencies and need internet access.

## Project structure

- `src/content/docs/en/`, `src/content/docs/zh-cn/`: the seven tutorials in each language, editable as Markdown.
- `src/examples/`: the seven original React playgrounds, including the layout configurations.
- `src/components/`: shared React graph components.
- `src/pages/examples/`: static Astro pages mounting each playground as a client-only React island.
- `public/demos/vanilla/`: original runnable HTML examples in both languages.
- `src/lib/chapters.ts`: chapter metadata and source mapping.
- `astro.config.mjs`: documentation, locale, and build settings.

The original two sibling repositories are unchanged. This directory is the combined successor; no Git histories were rewritten, remote repositories changed, or deployment performed.

## Migration notes

All 14 chapter bodies and all 14 standalone demos were carried over. Tutorial preview links now point to the local vanilla examples. Markdown titles are frontmatter so Starlight supplies the heading, table of contents, navigation, and search. The original Docsify configuration is superseded by Starlight.

The React playground controls and descriptions retain their original Chinese text; English and Chinese tutorial pages both link to them. Fixed missing extension type declarations, made layout registration idempotent, and prevented equivalent element props from erasing graph changes after a React render.

Next.js/Fumadocs was evaluated during the merge and replaced after the preference for a lightweight site. Mintlify was considered, but its documented third-party npm integration requires Enterprise, which is a poor fit for these embedded graph playgrounds.

Vanilla demos use semantic routes such as `/examples/vanilla/zh-cn/styles/`. Old demo URLs redirect to their replacements.

Tutorial routes use `/en/styles/` and `/zh-cn/styles/`; React playgrounds use `/examples/react/styles/`. Both demo modes use the shared documentation layout. Vanilla HTML is isolated inside an automatically sized frame to preserve its original scripts.
