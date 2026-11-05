# cytocausal plan

## Decisions

- **Stack:** cytocausal is Next.js plus Cytoscape.js. The apps and docs all run on Next.js, and Cytoscape only renders in the browser.
- **Docs:** built with Nextra.
- **One renderer:** both demos use Cytoscape.js. Explorer's graph (725 nodes, 1,494 edges) ran at 60 fps on the canvas renderer, without labels. WebGL gave no benefit at this size.
- **Precomputed positions:** a full fcose layout of Explorer's graph blocks the page for 1-4 s, so it stays out of page load.
- **Separate apps:** each demo keeps its own URL and links to the docs.
- **Cytoscape version:** pinned to 3.31.0 across the workspace. 3.34 ships its own types without `Stylesheet`, so upgrading is a separate change.
- **Zod version:** pinned to 4.1.12. Nextra 4.6.1 rejects every page under newer Zod (tested with 4.6.7), so remove the pin only after testing a newer Nextra.
- **Extraction rule:** a feature joins a package only once both demos use it.
- **Workshop data:** stays out of this repo until its public use is confirmed. `data/private/` is ignored.

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
Add chapters on the data model, React lifecycle, stable layouts and anchoring, version transitions, causal analysis, and scale and performance, in English and Chinese. Add a case study for each demo.

### 5. New capabilities and cutover
Add loop detection to both demos, labelling loops as reinforcing or balancing where polarity exists. Add version comparison to Explorer only if its older data can be matched up.

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
