---
title: "Case study: Causal Explorer"
---

# Case study: Causal Explorer

Causal Explorer shows the causal graph from the ACCESS benchmark, which covers abstract events in everyday life. Generalised event descriptions from the GLUCOSE dataset were clustered into abstract events, and annotators judged the causal links between them. The question is how events connect at scale.

![Causal Explorer showing the causes and effects of a selected node](/images/explorer-selection.png)

| Item | Details |
| :--- | :--- |
| Data | One network, in one snapshot |
| Size | 725 nodes and 1,494 edges |
| Links | Directed, without polarity |
| Evidence | 4,708 generalised event descriptions |
| Positions | Precomputed |

The figures above describe the full benchmark. The public demo shows a sample of its 100 most central events, and the full benchmark is [available on request](https://github.com/isVy08/ACCESS).

## What it needed

- Finding events by what they mean, not just by name
- Reading the sentences behind a node
- Seeing what causes a node and what it leads to
- A readable view of a dense graph

## What was wrong

The original app ran on Sigma, and its data was sound. The problems were in exploring it:

- Search only matched the start of a label, and 716 of 725 labels start with "a person". Searching for `sleep` found nothing.
- Sentences appeared in a hover card that vanished when the mouse moved away.
- Highlighting didn't separate causes from effects.
- Node sizes ignored direction.
- Every node was its own cluster, so the filters added up to 1,450 checkboxes that couldn't group anything.

## Moving to Cytoscape

The move depended on one question: could Cytoscape draw this graph with labels? [Benchmarks](/en/scale-performance/) showed 60 fps, so both demos could share one engine.

The harder problem was keeping labels readable, which took collision handling.

## How the framework solved it

| Need | Mechanism | Guide |
| :--- | :--- | :--- |
| Directed node sizes | `analyzeSnapshot` | [Causal analysis](/en/causal-analysis/) |
| Feedback loop toggle | `feedbackGroups` | [Causal analysis](/en/causal-analysis/) |
| Short loops through a node | `findFeedbackLoops` | [Causal analysis](/en/causal-analysis/) |
| Causes and effects | `highlightCausalNeighbours` | [Causal analysis](/en/causal-analysis/) |
| Fast first render | Saved positions | [Scale and performance](/en/scale-performance/) |
| Readable labels | `readableLabels` | [Scale and performance](/en/scale-performance/) |
| Selection and hover | `useCausalGraph` | [Interactions](/en/interactions/) |
| Searching labels and descriptions | `NodeSearch`, `focusNode` | [Getting started](/en/getting-started/) |

## Result

Search now finds words anywhere in labels and sentences. Clicking a node keeps its sentences, causes and effects in a side panel, and a second click compares two nodes. The analysis of the full graph also found something new: 213 of the 725 nodes form a single set of feedback loops, so the network isn't a simple chain of causes.

## Publication

The graph comes from [ACCESS: A Benchmark for Abstract Causal Event Discovery and Reasoning](https://arxiv.org/abs/2502.08148) (NAACL 2025), which is built on [GLUCOSE](https://arxiv.org/abs/2009.07758). GLUCOSE's license limits this data to non-commercial use.

## Run it

```sh
npm install
npm run dev:explorer
```

Open `http://localhost:3101`.
