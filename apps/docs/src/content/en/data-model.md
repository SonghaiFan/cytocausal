---
title: "Data model"
---

# Data model

cytocausal stores every causal graph in one shape, so the same views and analysis work on a small workshop diagram and a large extracted network. The types are in `@cytocausal/core`, which has no UI code. It uses Cytoscape only for headless analysis.

| Concept | Meaning | Perspectiva | Causal Explorer |
| :--- | :--- | :--- | :--- |
| `CausalDataset` | One graph and its versions | One participant | The whole network |
| `Snapshot` | One version of the graph | V1, final | One snapshot |
| `CausalNode` | A variable or event | A variable | A cluster of sentences |
| `CausalEdge` | A directed link | A link with polarity | A link without polarity |
| `Evidence` | Where a node came from | Original terms | Source sentences |
| `Correspondence` | Which node became which | V1 to final | Not used |

Polarity, evidence, positions and correspondences are all optional. Explorer has no polarity and Perspectiva has no saved positions, and both are valid.

## Build a dataset

```ts
import { validateDataset, type CausalDataset } from "@cytocausal/core";

const dataset: CausalDataset = {
  id: "workshop",
  snapshots: [
    {
      id: "V1",
      nodes: [
        { id: "rules", label: "Rules" },
        { id: "trust", label: "Trust" },
      ],
      edges: [{ id: "rules-trust", source: "rules", target: "trust", polarity: "positive" }],
    },
    {
      id: "final",
      nodes: [
        { id: "regulation", label: "Level of regulation" },
        { id: "trust", label: "Trust" },
      ],
      edges: [],
    },
  ],
  correspondences: [
    { from: "V1", to: "final", nodes: { rules: "regulation", trust: "trust" } },
  ],
};

console.log(validateDataset(dataset)); // []
```

## Why correspondences exist

Node ids cannot be compared between versions. A workshop participant might rename a variable or merge two into one, so the same concept can have different ids in each snapshot. A `Correspondence` records those links explicitly.

Several nodes can map to one target, which is how merges are represented. The reverse direction is worked out when needed.

This isn't a theoretical concern. Perspectiva compared versions by id at first, and only 44 of 126 mapped pairs shared an id, so its side-by-side view was barely aligned. See the [Perspectiva case study](/en/case-perspectiva/).

## Validate early

`validateDataset` returns a list of problems and doesn't throw, so you can decide how to report them:

- duplicate snapshots, nodes or edges
- edges that reference a missing node
- correspondences that reference a missing snapshot or node

Run it when data is imported, not when it's drawn. Cytoscape silently keeps only one element with a given id, so a duplicate edge would otherwise disappear without warning.

## Import existing data

Each source format has an importer that returns a `CausalDataset`:

```ts
import { importExplorer, validateDataset, type ExplorerData } from "@cytocausal/core";

export function load(raw: ExplorerData) {
  const dataset = importExplorer(raw);
  const issues = validateDataset(dataset);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  return dataset;
}
```

`importPerspectiva` merges exact repeats of a link, because two participants stating the same thing isn't an error. A link listed as both positive and negative stays in place, so validation reports it for a person to resolve.
