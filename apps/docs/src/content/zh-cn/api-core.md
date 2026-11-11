---
title: "Core API"
---

# Core API

本参考覆盖当前源码工作区的主要接入 API，package 尚未发布到 npm。其他导出与完整类型以链接的 TypeScript 源码为准。

`import { … } from "@cytocausal/core"`

不依赖渲染器、DOM 或运行时第三方库，可用于 Node.js、worker 和浏览器。

## 数据类型

| Type | 字段与规则 |
| --- | --- |
| `CausalDataset` | `id: string`, `snapshots: Snapshot[]`, `correspondences?: Correspondence[]` |
| `Snapshot` | `id: string`, `nodes: CausalNode[]`, `edges: CausalEdge[]` |
| `CausalNode` | `id`, `label`; optional `evidence`, `position: {x, y}`, `metadata` |
| `CausalEdge` | `id`, `source`, `target`; optional `polarity`, `evidence`, `metadata` |
| `Polarity` | `"positive" \| "negative"`; 省略表示未知 |
| `Evidence` | `id?`, `text?`, `contributor?`, 均为字符串 |
| `Correspondence` | `from`, `to`: snapshot ids; `nodes: Record<string, string>` |

[types.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/types.ts) · [Data model](/zh-cn/data-model/)

## validateDataset

```ts
validateDataset(dataset: CausalDataset): string[]
```

返回结构问题列表，无问题时为 `[]`，不修改输入。检查重复的快照、节点、连线 ID，缺失端点和无效对应引用；前一快照至少四个节点时，还会提示相邻版本中多数 ID 改变却没有对应表的情况。

它不是未知 JSON 的解析器，错误的数据形状可能直接抛错。它不检查节点和连线跨类型 ID 冲突，也不要求快照非空。外部数据需先解析，UI 至少需要一个快照。

## 快照与身份

| Call | 返回与行为 |
| --- | --- |
| `getSnapshot(dataset, id)` | `Snapshot`; 不存在时抛错并列出已知 ID |
| `hasCorrespondence(dataset, from, to)` | `boolean`; 检查两个方向的显式映射 |
| `getCounterparts(dataset, from, to)` | `Record<string, string[]>`; 只读取显式映射，包括合并的反向关系 |
| `followNodes(dataset, from, to)` | `NodeMapping`; 优先直接对应表，否则按数组顺序串联相邻版本 |

某一步没有对应表时按相同 ID 匹配。有显式表时，该版本对不再回退到相同 ID，因此要包含未变化的节点。`followNodes` 还会在中间断开后保留未被其他节点占用的同 ID 终点；详见源码。

[snapshots.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/snapshots.ts)

## diffSnapshots / changeMarks

```ts
diffSnapshots(dataset: CausalDataset, fromId: string, toId: string): SnapshotDiff
changeMarks(diff: SnapshotDiff, side: "from" | "to"): ChangeMarks
```

`SnapshotDiff` 包含 `addedNodes`、`removedNodes`、`renamedNodes`、`mergedNodes`、`splitNodes`、`regroupedNodes`、`addedLinks`、`removedLinks`、`changedLinks`。连线按对应端点组与极性比较，不只比较边 ID。它不是任意 metadata 或 evidence 的 diff。

`changeMarks` 为比较的一侧生成 ID 数组：`added`、`removed`、`changed`、`flipped`。

## findFeedbackLoops / findCausalPaths

```ts
findFeedbackLoops(snapshot: Snapshot, options?: LoopOptions): LoopSearch
findCausalPaths(snapshot: Snapshot, from: string, to: string, options?: PathOptions): PathSearch
```

| Option | Loops | Paths |
| --- | --- | --- |
| `maxLength` | `Infinity` | `8` |
| `limit` | `1000` | `50` |
| `through` | 可选节点 ID | — |

长度按节点数计算，不是边数。两者均先返回较短结果；限制可能隐藏其他结果时 `complete: false`。回路返回 `{ loops, complete }`，每个回路包含 `nodes`、`edges` 和 `type: "reinforcing" | "balancing" | "unknown"`。负边为奇数是平衡回路、偶数是增强回路，缺少任意极性则为未知。

路径返回 `{ paths, complete }`，节点和边按因果方向排列。`from === to` 返回空路径，查找环应使用回路 API。搜索为同步计算，在密集图上可能很昂贵，应限制范围或移入 worker。React UI 有自己的搜索设置，不能用 core 默认值推断 UI 默认值。

[运行分析示例](/zh-cn/example-analysis/)

## analyzeSnapshot

```ts
analyzeSnapshot(snapshot: Snapshot): SnapshotAnalysis
```

返回 `betweenness: Record<string, number>`（有向中介中心性，最大值归一化为 1，全零仍为零）和 `feedbackGroups: string[][]`（节点数大于一的强连通组，较大的组在前）。单节点自环不包含在 `feedbackGroups`，可用 `findFeedbackLoops` 枚举。这些是图结构指标，不是因果效应估计。

## 证据、搜索与历史

| Call | 结果 |
| --- | --- |
| `contributorsOf(item)` | 独立贡献者名称数组 |
| `supportOf(item)` | 独立贡献者数量，不是证据数 |
| `listContributors(snapshot)` | `{ contributor, nodes, links }[]` |
| `filterByContributors(snapshot, names)` | 保留署名连线及端点、署名节点的新快照 |
| `combineDatasets(datasets, options)` | `{ dataset, issues }`; `options.id` required; optional `key(node, dataset)`, `contributorOf(dataset)` |
| `searchNodes(nodes, text)` | `{ node, evidence? }[]`; 精确 ID 或标签/证据子串；子串至少两个字符 |
| `nodeHistory(dataset, version, nodeId)` | `NodeHistoryEntry[]` |
| `linkHistory(dataset, version, linkId)` | `LinkHistoryEntry[]` |

合并时默认用节点 ID 作为共享概念键，用数据集 ID 为无署名证据补充贡献者；相同 ID 的快照合并，极性相反的边分别保留。必须检查 `issues` 中未解决的冲突。传入空贡献者数组得到空图；UI 用 `null` 表示所有人，但这个 core 函数只接受数组。

[provenance.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/provenance.ts) · [history.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/core/src/history.ts) · [数据接入](/zh-cn/import-data/)
