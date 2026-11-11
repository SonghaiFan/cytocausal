# cytocausal Studio

A browser-local causal graph editor built with the cytocausal library. Run `npm run dev:studio` from the repository root, then open port 3103.

Create/delete nodes and directed links, edit labels and polarity, arrange or drag nodes, undo/redo structural edits, import/export `CausalDataset` JSON and explore the model with the library workspace. Deleting a node also removes incident links and affected correspondence entries. Imported evidence and metadata are preserved.

Data is stored under `cytocausal-studio-v1` in this origin's localStorage. It is not uploaded or synced. Export JSON for backup; browser clearing or switching domains/devices does not preserve local storage. Invalid imports leave the current graph intact. Replacing/resetting a graph asks for confirmation and can be undone. Position dragging is saved but is not a separate undo step.

Use `npm test -w @cytocausal/studio` and, after building, `npm run test:e2e -w @cytocausal/studio`.

Vercel project root: `apps/studio`; include source files outside the root. `NEXT_PUBLIC_DOCS_URL` points to the library docs. No server secrets or database are required.
