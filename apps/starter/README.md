# React starter

Run `npm run dev -w @cytocausal/starter` from the repository root.

- `/`: composable exploration workspace.
- `/editor`: editable graph using only public React and core package imports.

`src/components/EditorExample.tsx` demonstrates CausalEditor, onChange, a ref, document replacement and independent instances. It holds changes in React state without persistence. The Next.js loader provides a browser-only boundary; the editor has no Next.js dependency.

Import both `@cytocausal/react/styles.css` and `@cytocausal/react/editor.css` and provide a sized host. Packages currently resolve through this source workspace; npm tarball installation has not yet been validated.

Build with `npm run build -w @cytocausal/starter`; test with `npm run test:e2e -w @cytocausal/starter -- editor.spec.ts`.
