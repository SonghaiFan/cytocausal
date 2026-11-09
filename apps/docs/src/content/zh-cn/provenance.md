---
title: "出处与共识"
---

# 出处与共识

研究中的因果图是一组主张：某个人说 A 会导致 B。cytocausal 会记录每个节点和连线是谁提出的、依据是什么，让读者能把图的任何部分和来源对照。合并多个人的图时，同样的证据还能说明他们的共识有多大。

## 记录连线的提出者

连线和节点一样可以带 `evidence`。每条证据写明 `contributor`（比如某位参与者或某份文档），还可以引用一段 `text`。没有文字、只有提出者的证据同样有效，它记录了这条连线是谁提出的。

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

`contributorsOf` 列出节点或连线的提出者，每人只列一次。`supportOf` 返回人数。

## 合并多人的图

`combineDatasets` 把多个数据集（比如每位参与者一个）合并成一个。id 相同的快照会合并在一起，每个节点和连线都保留所有来源的证据。没有写明提出者的证据，会记在所属的数据集名下。

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

`key` 决定哪些节点是同一个概念，默认使用节点 id。只有当 id 在每个数据集里含义都相同时，默认值才是对的。Perspectiva 的情况就不是这样：节点 95 对一位参与者是 "Human autonomy"，对另一位却是 "Data subject interventions"。每个术语的 `key`（比如 `V2_83`）在整个工作坊中是统一的，所以合并时用的是它。

`issues` 列出合并时无法解决的问题：同一个 key 有两个标签，或者一个节点在另一个版本中对应到了两个不同的节点。

## 分歧

连接相同概念、极性也相同的连线会合并成一条。如果参与者对极性意见不一，两条连线会并排保留，id 类似 `a->b:positive` 和 `a->b:negative`。`LinkDetails` 会同时显示两条，`diffSnapshots` 会把它们的极性报告为 `"mixed"`。在 Perspectiva 工作坊中，参与者在 4 条连线上存在分歧。

## 在图上显示共识

`weightBySupport` 会让提出人数越多的连线画得越粗。只有一人提出的连线保持最细，所以在没有任何共同主张的图里，线宽不会显得有所强调。每个元素都带有 `support`（提出人数）和 `supportShare`（一人提出时为 0，人数最多时为 1），你自己的样式规则也可以使用。

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";

export const stylesheet = createCausalStyle(lightTheme, { weightBySupport: true });
```

使用 `CausalProvider` 时，改为通过 `styleOptions` 传入，图例会附上说明。

## 单个人的视角

`filterByContributors` 保留所选的人提出的内容：他们的连线、这些连线连接的节点，以及他们自己提出的节点。`listContributors` 列出所有提出者，以及每人提出了多少个节点和连线。

在图上，`hideExceptContributors` 会隐藏其余部分，不移动任何节点，方便把一个人的视角和整体对比。在 `CausalProvider` 中，`ContributorFilter` 会完成这件事；快照有两位或更多提出者时，它才会显示。

## 查看一条连线

点击连线会打开 `LinkDetails`，显示两端节点、极性、提出人数，以及按人分组的证据。悬停在连线上会显示简短的版本。使用键盘时，打开节点详情，再点每个原因或结果旁边的连线按钮。
