---
title: "数据模型"
---

# 数据模型

cytocausal 用同一种结构保存所有因果图，因此同样的视图和分析既能用于小型工作坊图，也能用于大型事件网络。类型定义在 `@cytocausal/core` 中，这个包不含 UI 代码，只在无界面分析时使用 Cytoscape。

| 概念 | 含义 | Perspectiva | Causal Explorer |
| :--- | :--- | :--- | :--- |
| `CausalDataset` | 一张图及其各个版本 | 一位参与者 | 整个网络 |
| `Snapshot` | 图的一个版本 | V1、final | 一个快照 |
| `CausalNode` | 变量或事件 | 变量 | 抽象事件 |
| `CausalEdge` | 有向连接 | 带极性的连接 | 不带极性的连接 |
| `Evidence` | 节点的来源 | 原始术语 | 事件描述 |
| `Correspondence` | 节点之间的版本对应 | V1 到 final | 未使用 |

极性、证据、位置和对应关系都是可选的。Explorer 没有极性，Perspectiva 没有保存位置，两者都是有效数据。

## 构建数据集

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

## 为什么需要对应关系

不同版本之间的节点 ID 不能直接比较。工作坊参与者可能会重命名变量，或把两个变量合并成一个，所以同一概念在不同快照里的 ID 可能不同。`Correspondence` 明确记录这些连接。

多个节点可以映射到同一个目标，这就是合并的表示方式。需要反向查找时，再由程序计算。

这不是假想的问题。Perspectiva 最初按 ID 比较版本，126 对映射节点中只有 44 对 ID 相同，所以左右对比几乎没有对齐。详见 [Perspectiva 案例](/zh-cn/case-perspectiva/)。

## 尽早验证

`validateDataset` 返回问题列表而不是抛出异常，由你决定如何报告：

- 重复的快照、节点或边
- 引用了不存在节点的边
- 引用了不存在快照或节点的对应关系

请在导入数据时运行，而不是等到绘制时。Cytoscape 对相同 ID 的元素只会静默保留一个，否则重复的边会毫无提示地消失。

## 导入现有数据

每种来源格式都有一个返回 `CausalDataset` 的导入器：

```ts
import { importExplorer, validateDataset, type ExplorerData } from "@cytocausal/core";

export function load(raw: ExplorerData) {
  const dataset = importExplorer(raw);
  const issues = validateDataset(dataset);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  return dataset;
}
```

`importPerspectiva` 会合并完全重复的连接，因为两位参与者说了同一件事并不是错误。如果一条连接同时被标为正向和负向，它会被保留下来，由验证报告给人来处理。
