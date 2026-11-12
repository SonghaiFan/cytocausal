# @cytocausal/react

A React library for causal graph exploration and authoring, built on Cytoscape.js.

Use CausalWorkspace for exploration, CausalEditor for editing, or compose provider-backed components. CausalEditor includes radial menus, cause/effect connections, inline naming, polarity and undo/redo. Your application owns persistence through onChange.

This alpha supports React 19 and Cytoscape.js 3.31.0. It ships ESM JavaScript, TypeScript declarations, CSS and layout/analysis workers. Graphs render in the browser and need a sized host; Next.js applications should use a client-only dynamic loader.

    import { CausalEditor } from "@cytocausal/react";
    import type { CausalDataset } from "@cytocausal/core";
    import "@cytocausal/react/styles.css";
    import "@cytocausal/react/editor.css";

    export function Editor({ data, save }: {
      data: CausalDataset;
      save: (next: CausalDataset) => void;
    }) {
      return <div style={{ height: 720 }}>
        <CausalEditor initialDataset={data} onChange={save} />
      </div>;
    }

initialDataset initializes one session. Use a ref's replaceDataset to load another document. onChange emits edits, undo and redo; the editor never writes localStorage. The current editor uses English labels and a light theme.

[Integration guide](https://songhaifan.github.io/cytocausal/en/components/) · [API contracts](https://songhaifan.github.io/cytocausal/en/api-react/) · [Studio](https://cytocausal-studio.vercel.app)
