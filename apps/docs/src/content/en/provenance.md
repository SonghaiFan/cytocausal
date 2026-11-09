---
title: "Provenance and agreement"
---

# Provenance and agreement

A causal graph from research is a set of claims: someone said that A leads to B. cytocausal keeps who said each node and link, and what they said, so a reader can check any part of the graph against its source. When several people's graphs are combined, the same evidence shows how far they agree.

## Record who stated a link

Links take `evidence`, the same as nodes. Each piece names a `contributor`, such as a participant or a source document, and can quote a `text`. A contributor with no text is still evidence: it records who stated the link.

```ts
import type { CausalEdge } from "@cytocausal/core";

export const link: CausalEdge = {
  id: "staff-queue",
  source: "staff",
  target: "queue",
  polarity: "negative",
  evidence: [
    { text: "A second person on the till halves the wait", contributor: "barista" },
    { contributor: "manager" },
  ],
};
```

`contributorsOf` lists who stated a node or link, each once. `supportOf` counts them.

## Combine several people's graphs

`combineDatasets` merges datasets, such as one per participant, into one. Snapshots with the same id are combined, and each node and link keeps every source's evidence. Evidence with no contributor is credited to its dataset.

```ts
import { combineDatasets, type CausalDataset } from "@cytocausal/core";

export function workshop(participants: CausalDataset[]) {
  const { dataset, issues } = combineDatasets(participants, {
    id: "workshop",
    key: (node) => String(node.metadata?.key),
  });
  if (issues.length > 0) throw new Error(issues.join("\n"));
  return dataset;
}
```

`key` decides which nodes are the same concept. It defaults to the node id, which is only right when ids mean the same thing in every dataset. In Perspectiva they don't: node 95 is "Human autonomy" for one participant and "Data subject interventions" for another. Each term's `key`, such as `V2_83`, is shared across the workshop, so that's what the combination uses.

`issues` lists what the combination can't settle: a key with two labels, or a node that corresponds to two different nodes in another version.

## Disagreement

Links are merged when they join the same concepts with the same polarity. When people disagree on the polarity, both links are kept side by side, with ids such as `a->b:positive` and `a->b:negative`. `LinkDetails` shows both, and `diffSnapshots` reports their polarity as `"mixed"`. In the Perspectiva workshop, participants disagree on 4 links.

## Show agreement on the graph

`weightBySupport` draws links thicker the more people stated them. Links stated by one person stay thin, so a graph where nobody shares a claim looks plain. Every element gets `support`, the number of people, and `supportShare`, from 0 for one person to 1 for the most supported, so your own style rules can use them too.

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";

export const stylesheet = createCausalStyle(lightTheme, { weightBySupport: true });
```

With `CausalProvider`, pass it as `styleOptions` instead, and the legend explains it.

## One person's view

`filterByContributors` keeps what the chosen people stated: their links, the nodes those links join, and their own nodes. `listContributors` lists everyone, with how many nodes and links each stated.

On a graph, `hideExceptContributors` hides the rest without moving anything, so you can compare one person's view with the whole. `ContributorFilter` does this inside a `CausalProvider`, and shows itself once a snapshot has two or more contributors.

## Reading a link

Click a link to open `LinkDetails`: its ends, polarity, how many people stated it, and their evidence grouped by person. Hovering a link shows a short version. From the keyboard, open a node's details and use the link button beside each cause or effect.
