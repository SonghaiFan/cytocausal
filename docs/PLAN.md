# cytocausal plan

## Decisions

- **Purpose:** cytocausal is a React library for causal graph interfaces, built on Cytoscape.js. React is the primary integration surface; causal-specific UX and analysis are its differentiators. The library supports two application paths: the browser-local Studio authoring app, and custom projects built from `apps/starter`. The starter is the current adoption path; the two research apps demonstrate the library.
- **Package boundaries:** `@cytocausal/core` is the renderer-independent data and analysis layer; Cytoscape.js integration lives in `@cytocausal/cytoscape`, and React UX lives in `@cytocausal/react`. The library extends Cytoscape.js through integration rather than maintaining a fork.
- **Availability:** packages are currently private source-workspace packages. Studio supports basic creation/editing and local JSON persistence. Standalone npm distribution and cloud collaboration remain future work.
- **Stack:** the apps and docs all run on Next.js, and graphs render in the browser with Cytoscape.js.
- **Docs:** built with Nextra.
- **One renderer:** both demos use Cytoscape.js, replacing Sigma in Explorer. Explorer's graph (725 nodes, 1,494 edges) ran at 60 fps on the canvas renderer on an M4 Mac, even with every label drawn. WebGL gave no benefit at this size.
- **Precomputed positions:** a full fcose layout of Explorer's graph blocks the page for 1-4 s, so it stays out of page load.
- **Deployment:** the homepage and bilingual docs are statically exported to GitHub Pages under `/cytocausal`. Studio, Perspectiva and Explorer are separate Vercel projects, each linking to the docs.
- **Cytoscape version:** pinned to 3.31.0 across the workspace. 3.34 ships its own types without `Stylesheet`, so upgrading is a separate change.
- **Zod version:** pinned to 4.1.12. Nextra 4.6.1 rejects every page under newer Zod (tested with 4.6.7), so remove the pin only after testing a newer Nextra.
- **Extraction rule:** a feature joins a package only once both demos use it, or when it is core to the framework. Importers stay in `core` beside the tests that check them.
- **Workshop data:** public, confirmed by Songhai Fan. It lives in `apps/perspectiva/data/`, generated from the Perspectiva project.

## React library release priorities

1. Make `@cytocausal/react` the primary documented entry point. Retain core analysis and Cytoscape integration as supporting packages. A framework-independent menu or `cytoscape.use()` adapter is not a prerequisite for this release.
2. Extract reusable authoring behaviour from Studio: document edits and history, the edit ring, inline naming, cause/effect connect-or-create gestures, polarity editing, and mode continuity. Keep browser storage, file dialogs, project naming and app branding in Studio.
3. Define an authoring integration contract before exposing it: initial document, change notifications, selection/viewport ownership, undo scope, externally replaced data and lifecycle cleanup. Reuse the same implementation in Studio and a minimal independent React example.
4. Validate extraction against existing Studio browser tests, plus two independent editor instances, unmount during a gesture, and parent-provided document updates. Preserve Explore behaviour and selection/camera continuity.
5. Build ESM JavaScript, declarations, CSS and worker assets; preserve React client boundaries. Replace wildcard package dependencies, define tested peer dependency ranges, and include package README/LICENSE metadata.
6. Install packed tarballs in independent React/Vite and Next.js consumers, exercising workers and editing as well as exploration. These must not depend on workspace source aliases.
7. Publish a synchronized alpha via the `next` tag only after npm ownership and release configuration are verified. Authoring is not advertised as a reusable package feature until steps 2–4 pass.

Current status: React positioning and the first authoring extraction are implemented. Studio consumes the public CausalEditor; the starter /editor example exercises callbacks, document replacement, isolated histories and unmount cleanup. ESM/declaration/CSS builds, self-contained workers and tarball consumer verification are provided by the release scripts; npm publication remains pending. See docs/maintenance/npm-release.md for the validation and publication boundary. The editor currently provides a complete surface with header/toolbar/footer slots, not separate headless authoring hooks.

## Phases

### 0. Prepare
Create this workspace, import the docs and merge Perspectiva PR #5.

### 1. Core
Build the schema, one importer per project, and validation.

Done when both datasets load and these results hold: 129 Perspectiva anchors, a 213-node strongly connected set in Explorer, and 400 nodes with zero directed betweenness.

### 2. Perspectiva
Move Perspectiva onto the framework, extracting from working code. Turn the browser checks into Playwright tests.

Done when alignment and version transition offsets are still 0.

### 3. Explorer
Move Explorer from Create React App to Next.js. Retest performance with labels first. If that fails, Explorer keeps Sigma as its renderer and shares only `core`.

Done when it matches the current app and fixes search, the sentence panel, cause and effect highlighting, and directed node sizing.

### 4. Docs
Add guides on the data model, React lifecycle, stable layouts and anchoring, version transitions, causal analysis, and scale and performance, in English and Chinese. Add a case study for each demo. The earlier Cytoscape tutorials were removed, and remain in the `learning-cytoscape` project.

### 5. New capabilities and cutover
Loop detection is done in both demos, with loops labelled as reinforcing or balancing where polarity exists. Add version comparison to Explorer only if its older data can be matched up.

Switch each live site over only once the new app matches the old one.

## Data model

| Concept | Perspectiva | Explorer |
| --- | --- | --- |
| Node | Variable | Sentence cluster |
| Edge | Link with polarity | Direction only |
| Evidence | `history` | `textContent` |
| Snapshot | V1, final | Single version for now |
| Correspondence | `nodeAnchors` | Not used yet |
| Contributors | Participants | Not applicable |

Polarity, snapshots and contributors are optional.


## Library documentation and identity

- Navigation follows Start → Concepts → Guides → Examples → API reference → Case studies, preserving existing guide URLs.
- `import-data.mdx` walks through parsing external JSON, identity, structural validation, evidence, rendering and version correspondence.
- Four independent examples in `apps/docs/src/components/examples/` are compiled with the site. Their displayed source is checked against the executable files; importer and graph-result checks run with `npm run test:examples -w @cytocausal/docs`.
- The API reference covers the main integration surface of core, React and Cytoscape packages, with source links for the wider export surface. It does not imply a published npm release.
- The visual identity is the yellow causal sunburst: `#F4CD3C` with ink `#20201C`, a yellow focus node, stepped radial sectors and directed causal paths. Canonical SVGs live in `apps/docs/public/brand/`; the brand guides define usage. Graph semantic colours remain separate.

- **Visual hammer correction:** sunburst exploration + causal graph + yellow. The identity uses a yellow focal node, radial sectors and directed paths; the real radial-menu interaction supplies the behaviour.
