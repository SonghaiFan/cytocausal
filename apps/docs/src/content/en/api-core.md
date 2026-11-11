---
title: "Core API"
---

# Core API

This reference covers the primary integration APIs in the current source workspace. Packages are not yet published to npm. The linked TypeScript source is the authority for additional exports.

`import { … } from "@cytocausal/core"`

No renderer, DOM or runtime dependencies. Usable in Node.js, workers and browsers.

## Data types

| Type | Fields and contract |
| --- | --- |
| `CausalDataset` | `id: string`, `snapshots: Snapshot[]`, `correspondences?: Correspondence[]` |
| `Snapshot` | `id: string`, `nodes: CausalNode[]`, `edges: CausalEdge[]` |
| `CausalNode` | `id`, `label`; optional `evidence`, `position: {x, y}`, `metadata` |
| `CausalEdge` | `id`, `source`, `target`; optional `polarity`, `evidence`, `metadata` |
| `Polarity` | `"positive" \| "negative"`; omit when unknown |
| `Evidence` | `id?`, `text?`, `contributor?`, all strings |
| `Correspondence` | `from`, `to`: snapshot ids; `nodes: Record<string, string>` |

[types.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/types.ts) · [Data model](/en/data-model/)

## validateDataset

```ts
validateDataset(dataset: CausalDataset): string[]
```

Returns structural issues, or `[]`. It does not mutate the input. Checks duplicate snapshot/node/edge ids, missing edge endpoints and invalid correspondence references. It also warns when most ids change between adjacent snapshots without a correspondence (for an earlier snapshot of at least four nodes).

Not an unknown-JSON parser: malformed input can throw. It does not check node/edge cross-kind id collisions or require nonempty snapshots. Parse external values first; UI consumers require at least one snapshot.

## Snapshots and identity

| Call | Return and behaviour |
| --- | --- |
| `getSnapshot(dataset, id)` | `Snapshot`; throws with known ids if absent |
| `hasCorrespondence(dataset, from, to)` | `boolean`; checks explicit maps in either direction |
| `getCounterparts(dataset, from, to)` | `Record<string, string[]>`; explicit maps only, including reverse merges |
| `followNodes(dataset, from, to)` | `NodeMapping`; direct correspondence first, otherwise follows adjacent versions in array order |

With no correspondence for a step, matching ids establish identity. An explicit map replaces that fallback for its pair, so list unchanged nodes too. `followNodes` also preserves an unclaimed same-id endpoint after a gap; see source for this fallback.

[snapshots.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/snapshots.ts)

## diffSnapshots / changeMarks

```ts
diffSnapshots(dataset: CausalDataset, fromId: string, toId: string): SnapshotDiff
changeMarks(diff: SnapshotDiff, side: "from" | "to"): ChangeMarks
```

`SnapshotDiff` contains `addedNodes`, `removedNodes`, `renamedNodes`, `mergedNodes`, `splitNodes`, `regroupedNodes`, `addedLinks`, `removedLinks`, `changedLinks`. Links are compared by corresponding endpoint groups and polarity, not just edge ids. This is not a general metadata or evidence diff.

`changeMarks` returns id arrays `added`, `removed`, `changed`, `flipped` for one side of the comparison.

## findFeedbackLoops / findCausalPaths

```ts
findFeedbackLoops(snapshot: Snapshot, options?: LoopOptions): LoopSearch
findCausalPaths(snapshot: Snapshot, from: string, to: string, options?: PathOptions): PathSearch
```

| Option | Loops | Paths |
| --- | --- | --- |
| `maxLength` | `Infinity` | `8` |
| `limit` | `1000` | `50` |
| `through` | Optional node id | — |

Length counts nodes, not edges. Both return shortest results first, with `complete: false` when bounds may hide results. Loops return `{ loops, complete }`; each loop contains `nodes`, `edges`, and `type: "reinforcing" | "balancing" | "unknown"`. An odd number of negative links balances; an even number reinforces; any missing polarity makes the type unknown.

Paths return `{ paths, complete }` with node and edge ids in causal order. `from === to` returns no paths; use loop search for cycles. Searches are synchronous and can grow rapidly on dense graphs. Bound them or move them to a worker. The React UI has its own search settings; these core defaults do not describe UI defaults.

[Run the analysis example](/en/example-analysis/)

## analyzeSnapshot

```ts
analyzeSnapshot(snapshot: Snapshot): SnapshotAnalysis
```

Returns `betweenness: Record<string, number>` (directed betweenness scaled so the maximum is 1; all zeros remain zero) and `feedbackGroups: string[][]` (strongly connected groups of more than one node, largest first). A singleton self-loop is not included in `feedbackGroups`; use `findFeedbackLoops` to enumerate it. These are structural measures, not causal effect estimates.

## Evidence, search and history

| Call | Result |
| --- | --- |
| `contributorsOf(item)` | Unique contributor names from evidence |
| `supportOf(item)` | Number of unique contributors, not evidence records |
| `listContributors(snapshot)` | `{ contributor, nodes, links }[]` |
| `filterByContributors(snapshot, names)` | Snapshot retaining attributed links, their endpoints and attributed nodes |
| `combineDatasets(datasets, options)` | `{ dataset, issues }`; `options.id` required; optional `key(node, dataset)`, `contributorOf(dataset)` |
| `searchNodes(nodes, text)` | `{ node, evidence? }[]`; exact id or label/evidence substring; substring needs ≥2 characters |
| `nodeHistory(dataset, version, nodeId)` | `NodeHistoryEntry[]` |
| `linkHistory(dataset, version, linkId)` | `LinkHistoryEntry[]` |

Combining defaults to node id as the shared concept key, and dataset id as contributor for unattributed evidence. Same-id snapshots merge. Opposite polarities stay as separate links. Inspect `issues`; it reports unresolved conflicts. Contributor filtering with `[]` yields an empty graph; the UI uses `null` to mean everyone, but this core function takes an array.

[provenance.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/provenance.ts) · [history.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/history.ts) · [Data tutorial](/en/import-data/)
