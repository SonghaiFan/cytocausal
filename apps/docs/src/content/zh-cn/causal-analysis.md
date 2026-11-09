---
title: "因果分析"
---

# 因果分析

在因果图中，方向就是边的含义。“下雨导致地面变湿”与反过来并不相同，所以分析必须遵循边的方向。`@cytocausal/core` 中的 `analyzeSnapshot` 用无浏览器模式的 Cytoscape 做到这一点：

```ts
import { analyzeSnapshot, type Snapshot } from "@cytocausal/core";

const snapshot: Snapshot = {
  id: "demo",
  nodes: ["a", "b", "c"].map((id) => ({ id, label: id })),
  edges: [
    { id: "a-b", source: "a", target: "b" },
    { id: "b-c", source: "b", target: "c" },
    { id: "c-b", source: "c", target: "b" },
  ],
};

const { betweenness, feedbackGroups } = analyzeSnapshot(snapshot);
console.log(feedbackGroups); // [["b", "c"]] in either order
console.log(betweenness);
```

可以在脚本或服务器中运行。Explorer 在导入数据时运行它，这样页面加载时只需绘制图。

## 有向中心性

介数中心性用于找出位于许多最短路径上的节点。忽略方向时，会计入因果关系实际上无法通过的路径。

Causal Explorer 原来的节点大小忽略了方向。按边的方向重新计算后，结果明显不同：

| 指标 | 无向 | 有向 |
| :--- | :--- | :--- |
| 得分为 0 的节点 | 247 | 400 |
| 前 20 名中相同的节点 | 20 | 13 |

两种得分的等级相关系数为 0.74，说明它们相关，但不能互换。请向 `betweennessCentrality` 传入 `directed: true`，`analyzeSnapshot` 已经替你这样做了。

## 反馈回路

带有反馈的因果网络不是一条因果链。`feedbackGroups` 列出节点数大于 1 的强连通分量，也就是一组能够互相到达的节点，因此每组至少包含一个回路。它使用 Cytoscape 的 `tarjanStronglyConnected`。

Explorer 的网络中有一个这样的分组，包含 725 个节点中的 213 个，约占 29%，与 NetworkX 的结果一致。应用中可以通过 “Show only feedback loops” 单独查看回路。

分组能说明回路存在，但不能说明每个回路是什么，也不能说明它的行为。要了解这些，请列出回路本身。

## 单个回路

`findFeedbackLoops` 按从短到长列出每个回路，每个回路只列一次，并根据连接极性分类：

```ts
import { findFeedbackLoops, type Snapshot } from "@cytocausal/core";

const snapshot: Snapshot = {
  id: "demo",
  nodes: [
    { id: "trust", label: "Trust" },
    { id: "use", label: "Use" },
  ],
  edges: [
    { id: "trust-use", source: "trust", target: "use", polarity: "positive" },
    { id: "use-trust", source: "use", target: "trust", polarity: "negative" },
  ],
};

const { loops, complete } = findFeedbackLoops(snapshot);
console.log(loops[0].nodes); // ["trust", "use"]
console.log(loops[0].type); // "balancing"
console.log(complete); // true
```

| 负向连接 | 类型 | 行为 |
| :--- | :--- | :--- |
| 偶数条 | `reinforcing` | 变化不断自我增强 |
| 奇数条 | `balancing` | 变化受到抑制 |
| 缺少极性 | `unknown` | 无法分类 |

在 Perspectiva 的 16 张图中，它找到 89 个回路：59 个增强回路和 30 个平衡回路。有两位参与者的图在两个版本中都没有回路，所以要处理空列表。

### 大型图

回路数量会随图的规模迅速增长。在大型图上请设置 `maxLength`，并用 `through` 围绕单个节点搜索。如果 `maxLength` 或 `limit` 可能隐藏了回路，`complete` 为 `false`，所以不要把截断后的列表当作完整数量。搜索按长度逐级进行，所以被 `limit` 截断的列表仍然是最短的那些回路。

| Explorer 中的最大长度 | 回路数 |
| :--- | :--- |
| 3 | 18 |
| 4 | 57 |
| 5 | 159 |
| 6 | 463 |

这些数量，以及 Perspectiva 的每个回路及其类型，都与 NetworkX 的 `simple_cycles` 一致。

要显示回路，请把它传给 `highlightRoute(cy, loop)`。它会添加 `route-node` 和 `route-link` 类并淡化其他元素。传入 `null` 可清除高亮。

## 原因和结果

高亮邻居时，应该区分指向节点的内容和从节点出发的内容。`highlightCausalNeighbours` 会添加可供设置样式的类：

```ts
import { highlightCausalNeighbours } from "@cytocausal/cytoscape";
import type { Core } from "cytoscape";

export function followSelection(cy: Core, selected: string[]) {
  highlightCausalNeighbours(cy, selected);
}
```

| 类 | 作用对象 |
| :--- | :--- |
| `focus` | 传入的节点 |
| `cause`、`cause-link` | 直接原因及其连接 |
| `effect`、`effect-link` | 直接结果及其连接 |
| `dimmed` | 其他所有元素 |

请使用 `node.incomers()` 和 `node.outgoers()`。`node.neighborhood()` 会忽略方向。

传入深度可以延伸得更远：`highlightCausalNeighbours(cy, selected, 2)` 还会标记原因的原因和结果的结果。在回路中，一个节点可能同时是两者。

## 路径

`findCausalPaths` 沿着每条连线的方向，列出从一个节点到另一个节点的路线。每条路线不会重复经过同一节点。

```ts
import { findCausalPaths, type Snapshot } from "@cytocausal/core";

export function routes(snapshot: Snapshot) {
  const { paths, complete } = findCausalPaths(snapshot, "customers", "queue", {
    maxLength: 8,
    limit: 50,
  });
  return complete ? paths : paths.slice(0, 10);
}
```

路径按从短到长排列，被 `limit` 截断时保留的是最短的路径。`maxLength` 按节点计数。`maxLength` 或 `limit` 可能隐藏了部分路径时，`complete` 为 `false`。

## 版本差异

`diffSnapshots` 比较两个快照。它使用数据集中的对应关系（两个方向都可以），没有时按相同 id 匹配。反向比较时，新增和删除互换，合并和拆分互换。快照 id 不存在时会抛出错误，并列出数据集里有哪些快照。

```ts
import { diffSnapshots, type CausalDataset } from "@cytocausal/core";

export function summary(dataset: CausalDataset) {
  const diff = diffSnapshots(dataset, "V1", "final");
  return `${diff.addedNodes.length} added, ${diff.removedNodes.length} removed`;
}
```

| 字段 | 内容 |
| :--- | :--- |
| `addedNodes`、`removedNodes` | 没有对应项的节点 |
| `renamedNodes` | 标签改变的节点，格式为 `{ from, to }` |
| `mergedNodes` | 合并为一个的多个节点，格式为 `{ from, to }` |
| `splitNodes` | 拆分成多个的一个节点，格式为 `{ from, to }` |
| `regroupedNodes` | 多个节点重新分组为另外多个节点，格式为 `{ from, to }` |
| `addedLinks`、`removedLinks` | 没有对应项的连线 |
| `changedLinks` | 极性改变的连线，格式为 `{ from, to, polarity }` |

连线按它们连接的节点比较，所以同一对节点之间的平行连线算作一条。平行连线的极性不一致时，极性为 `"mixed"`。
