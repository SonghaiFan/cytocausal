# Perspectiva

Compares versions of causal loop diagrams from participatory workshops. Pick a participant, then view their first and final diagrams side by side with matching nodes in the same place, or switch between them on one graph.

This app is built on the cytocausal packages. From the repository root:

```sh
npm run dev:perspectiva
```

Open `http://localhost:3100`. Add `?dataset=expert_9` to open a dataset, and `?debug=1` to show the dataset selector.

## Data

`data/datasets.json` is generated from the original Perspectiva project:

```sh
CYTOCAUSAL_PERSPECTIVA=/path/to/perspectiva npm run import-data -w @cytocausal/perspectiva
```

## Tests

`npm run test:e2e` runs the browser tests against a production build, so run `npm run build -w @cytocausal/perspectiva` first. They need Chrome installed.
