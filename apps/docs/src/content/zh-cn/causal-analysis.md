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

Explorer 的网络中有一个这样的分组，包含 725 个节点中的 213 个，约占 29%，与 NetworkX 的结果一致。应用中可以通过 “Show only feedback loops” 单独查看。

分组能说明回路存在，但不能说明每个回路是什么，也不能说明它的行为。列出单个回路，并根据连接极性标记为增强回路或平衡回路，计划在后续阶段实现。

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
