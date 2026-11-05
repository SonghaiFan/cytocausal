# Causal Explorer

Explores a sample of the causal graph from the [ACCESS benchmark](https://arxiv.org/abs/2502.08148), which links abstract events in everyday life. Search nodes and sentences, trace what causes each node and what it leads to, compare two nodes, and isolate the network's feedback loops.

This app is built on the cytocausal packages. From the repository root:

```sh
npm run dev:explorer
```

Open `http://localhost:3101`.

## Data

`public/dataset.json` is a sample of the graph, generated from the original Causal Explorer project with its node scores and feedback loops:

```sh
CYTOCAUSAL_EXPLORER=/path/to/causal_explorer npm run import-data -w @cytocausal/explorer
```

The full benchmark is [available on request](https://github.com/isVy08/ACCESS). If you have it, add `-- --full` to that command, then run the app with `NEXT_PUBLIC_EXPLORER_DATA=/dataset.full.json`. Git ignores that file, so don't publish it.

The data is built on GLUCOSE and limited to non-commercial use. See [DATA.md](../../DATA.md).

## Tests

`npm run test:e2e` runs the browser tests against a production build, so run `npm run build -w @cytocausal/explorer` first. They need Chrome installed.
