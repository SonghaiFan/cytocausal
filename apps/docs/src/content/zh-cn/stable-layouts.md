---
title: "稳定布局与锚定"
---

# 稳定布局与锚定

要比较一张图的两个版本，读者需要看到相同的节点出现在相同的位置。力导向布局本身做不到这一点，因为它独立排列每张图。锚定的做法是固定一个版本的布局，再围绕它放置另一个版本。

`CompareView` 完成了全部工作：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import { CompareView } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";
import { useRef } from "react";

const stylesheet: Stylesheet[] = [{ selector: "node", style: { label: "data(label)" } }];

export function Comparison({ dataset }: { dataset: CausalDataset }) {
  const positionCache = useRef<Record<string, Positions>>({});
  return (
    <CompareView
      dataset={dataset}
      left="V1"
      right="final"
      layout={fcoseLayout}
      stylesheet={stylesheet}
      positionCache={positionCache}
    />
  );
}
```

## 锚定的原理

1. 左图运行布局。
2. 它的位置经过数据集的对应关系，转换为以右图 ID 为键。
3. 右图钉住这些节点，由 fcose 在周围放置其余节点。

用底层函数表示同样的步骤：

```ts
import { alignPositions, getCounterparts, placeAround, type Positions } from "@cytocausal/cytoscape";
import type { CausalDataset } from "@cytocausal/core";
import type { Core } from "cytoscape";

export function placeFinal(cy: Core, dataset: CausalDataset, v1Positions: Positions) {
  const counterparts = getCounterparts(dataset, "V1", "final");
  const anchors = alignPositions(v1Positions, counterparts);
  placeAround(cy, anchors)?.run();
}
```

`getCounterparts` 支持两个方向。`alignPositions` 把合并后的节点放在其来源节点的中心。

## 钉住节点，而不是事后移动

最初的做法是让右图运行完整布局，再把匹配的节点移过去。这样有两个问题：

- 较慢的布局后完成，会覆盖移动过的节点。使用 cola 时，所有锚定节点都偏离了位置。
- 新节点留在旧布局的位置上，和移过来的节点相撞。

fcose 的 `fixedNodeConstraint` 同时解决了这两个问题，因为它一次就能围绕固定节点排列新节点。只有 fcose 支持这项功能，所以即使左图选择 cola，右图也使用 fcose。

## 不要运行会被替换的布局

右图先隐藏，并使用开销很小的 `grid` 布局，直到左图的位置到达。否则较慢的布局可能在锚定之后才结束。隐藏右图也让读者看不到占位状态。

## 首次渲染跳过动画

首次布局没有之前的状态可供过渡。节点从原点飞入，并不能说明数据的任何信息。`GraphView` 在首次渲染时设置 `animate: false`，把动画留给真实的变化。

## 让位置和数据保持对应

位置只对产生它们的数据集和布局有意义。`CompareView` 用这两者标记位置，并忽略不匹配的结果，所以上一个数据集迟到的结果不会影响右图。

## 共享位置缓存

`positionCache` 以数据集、布局和快照为键。所有视图都会写入，所以某个版本在 `1 Graph` 视图中的位置，与它在 `2 Graphs` 视图中完全一致。

## 局限

锚定位置是精确的，但仍可能有少量重叠。如果标签在版本之间变长，节点会变宽，而它又不能离开原来的位置。两张图也各自适配边界，所以即使坐标相同，打开时的缩放比例也可能不同。
