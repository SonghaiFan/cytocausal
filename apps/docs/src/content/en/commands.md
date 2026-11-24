---
title: "Edit data and share selection"
---

# Edit data and share selection

Create one dataset and undo history with `useCausalDocument`, then pass the document to `CausalProvider` or `CausalWorkspace`. Graphs, toolbars and editors edit the same document.

```tsx
"use client";
import { CausalGraph, CausalProvider, useCausal, useCausalDocument } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { dataset } from "./data";

export function App() {
  const document = useCausalDocument({ initialDataset: dataset });
  return <CausalProvider document={document}>
    <Toolbar />
    <div style={{ height: 460 }}><CausalGraph /></div>
  </CausalProvider>;
}

function Toolbar() {
  const { edit, selection } = useCausal();
  if (!edit) return null;
  return <>
    <button onClick={() => edit.addNode({ label: "Sunlight" })}>Add node</button>
    <button onClick={() => edit.remove(selection.current())}>Delete selected</button>
    <button onClick={() => edit.undo()}>Undo</button>
  </>;
}
```

This is a minimal integration; a production toolbar should inspect the returned `ok` and display `error.message`. `initialDataset` is read once when creating the document. Connect the hook’s `onChange` callback to your own persistence; the framework does not save automatically.

## Atomic edits and history

```ts
const result = edit.batch("Add sunlight", draft => {
  const sun = draft.addNode({ label: "Sunlight" });
  draft.addEdge({ source: sun.id, target: "water", polarity: "negative" });
});
if (!result.ok) showError(result.error.message);
```

The provider’s `edit` is bound to its current snapshot. A batch commits once, notifies once and creates one undo entry. Its callback must be synchronous; validation failure, nested document commands or a thrown error roll back the whole batch. Deleting nodes also removes incident edges and affected correspondences, leaving other snapshots intact.

Commands return `{ ok: true, value: { changed, revision, value } }` or `{ ok: false, error }`. No-op edits do not increment the revision or clear redo. Read `canUndo`, `canRedo` and `revision` with `useCausalDocumentState(document)`.

## Queries and selection

```ts
selection.set(query.nodes({ metadata: { category: "weather" } }));
selection.all({ kind: "nodes", scope: "visible" });
selection.invert();
selection.clear();
```

`query.node/edge` read detached objects; `query.nodes/edges` return ID collections. Property filters, predicates, union, intersection, difference and filter are supported; collection combinations return a Result whose `ok` must be checked. Queries currently cover the complete snapshot. Collections carry `snapshotId` and `revision`; edits and selection commands reject collections from another version or revision.

The selection interface shares state with framework interactions and supports mixed node/edge selection. `maxSelected` caps selected nodes and returns an error when exceeded. `all` and `invert` default to the complete snapshot; `scope: "visible"` explicitly restricts them to visible elements and requires a mounted graph.

## Camera and JSON

```ts
view.fit({ padding: 40 });
view.zoom({ factor: 1.2 });
view.pan({ by: { x: 40, y: 0 } });
view.controls({ dragging: false });

const parsed = io.parse({ format: "dataset-json", text });
if (parsed.ok) edit.replaceDataset(parsed.value.dataset);
const output = io.export({ format: "dataset-json" });
```

Camera commands and input controls affect only the current view. To persist positions, call `view.positions()`, check success and pass the positions to `edit.setPositions(...)`. Camera commands return `ViewUnavailable` before the graph is ready. Input controls are reapplied when that view’s renderer is replaced.

Parsing JSON does not modify the document; apply only after success. Export returns JSON text without downloading it. `document.replaceDataset(...)` is undoable; `document.load(...)` opens new content and clears history without triggering the hook’s save callback. CSV, image output, asynchronous layout and advanced appearance commands are not part of this command surface yet.

## Existing integrations

Existing `dataset={dataset}` integrations remain valid. In that mode `edit` is null and the application manages data through its own React state. Pass either `document` or `dataset`. Multiple providers can share a document and history while keeping separate versions, selections and cameras.

`CausalEditor` also accepts `document`, while its existing `initialDataset` input remains valid. The editor ref and header/toolbar callbacks expose the same commands as `api.edit` and `api.selection`; existing replacement, renaming, undo and redo methods remain available.

## Standalone examples and source

- [Element editing and history](/examples/en/cytocausal/elements/)
- [Selection and camera controls](/examples/en/cytocausal/events/)
- [JSON import and export](/examples/en/cytocausal/data/)
