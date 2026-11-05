# Causal Explorer

Explores a network of causal relationships between clusters of sentences. Search nodes and sentences, trace what causes each node and what it leads to, compare two nodes, and isolate the network's feedback loops.

This app is built on the cytocausal packages. From the repository root:

```sh
npm run dev:explorer
```

Open `http://localhost:3101`.

## Data

`public/dataset.json` is generated from the original Causal Explorer project, including node scores and feedback loops:

```sh
CYTOCAUSAL_EXPLORER=/path/to/causal_explorer npm run import-data -w @cytocausal/explorer
```

## Tests

`npm run test:e2e` runs the browser tests against a production build, so run `npm run build -w @cytocausal/explorer` first. They need Chrome installed.
