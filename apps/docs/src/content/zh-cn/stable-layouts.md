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

## 选择布局

`@cytocausal/cytoscape` 导出的 `layouts` 包含 Cytoscape 自带的所有布局，以及本包注册的扩展布局，每个都针对因果图做了设置。传入一个作为 `layout`，或者传入多个作为 `layouts` 供用户选择。

| 名称 | 作用 | 适合 |
| :--- | :--- | :--- |
| `fcose` | 力导向布局，速度快、分布均匀 | 大多数图，以及版本之间的锚定 |
| `cola` | 力导向布局，带有逐渐稳定的动画 | 适合观察布局稳定过程的小型图 |
| `dagre` | 按层次从左到右排列原因到结果，必要时打断回路 | 阅读因果顺序 |
| `breadthfirst` | 从没有原因的节点开始向下生长成树 | 回路少、起始原因明确的图 |
| `concentric` | 同心圆，最核心的节点在中间，依据 `score` 数据，没有时依据度数 | 找出枢纽节点 |
| `cose` | Cytoscape 内置的力导向布局 | 无法使用 fcose 时。fcose 通常更好 |
| `circle`、`grid` | 单个圆或网格，按节点的核心程度排序 | 比较节点，而不是结构 |
| `random` | 随机位置 | 测试 |

```tsx
import { layouts } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";

// 只定义一次，这样每种选择都能保留自己的位置
const choices = { force: layouts.fcose, flow: layouts.dagre, hubs: layouts.concentric };

export const App = ({ dataset }) => <CausalWorkspace dataset={dataset} layouts={choices} />;
```

其他任何 Cytoscape 布局也都可以使用。先用 `cytoscape.use` 注册一次扩展，再传入它的选项。请让布局对象在多次渲染之间保持不变：位置按每个布局对象分别缓存，所以同一布局的两种设置（比如按中心性和按度数的 concentric）会各自保留自己的位置。

### 自适应的间距

固定的间距只适合一种节点大小。装着长标签的胶囊比圆点宽好几倍，如果连线长度固定，它们就会挤在一起。所以力导向布局会根据每个节点的大小来计算间距：连线的理想长度是刚好让两端节点分开，再加上一段间隙；节点越大，排斥力也越大。dagre 和环形布局本身已经考虑了节点大小。

曲线连线的弯曲程度与长度成正比，由 `curveLinks` 计算。较长的连线（比如在流向布局里反向回去的那条）会弧形绕开原本会和它重叠的连线。两个节点之间方向相反的两条连线会弯向两侧。每当节点稳定下来或被拖动时，`GraphView` 都会更新弯曲程度。

`layoutQuality(cy)` 按实际绘制的结果，统计让布局难以阅读的情况：节点重叠、连线穿过节点和连线交叉。可以用它来比较哪种布局最适合你的数据。环形布局无法让每条连线都避开环之间的节点，所以使用 `concentric` 时，会有少量连线穿过节点。

## 在同一张图上切换布局

给 `GraphView` 传入 `animateLayouts`，切换 `layout` 时节点会移动到新位置，而不是重建整张图。`CausalGraph` 已经替你打开了它，所以只要修改 `CausalProvider` 的 `layout` 就够了。每种布局的位置都会存进位置缓存，所以切换回去时，每个节点都会回到原来的位置。已保存的布局会让节点回到数据中的位置。

每种布局都有自己的原点。concentric 以画布为中心，所以节点会先飞出屏幕，镜头才追上。因此布局会先算出来，再移到图当前所在位置的中心。节点沿直线移动，所以始终在同时包含起点和终点的范围之内：如果这个范围超出屏幕，镜头会先拉远把它框住，等节点到位后再推近。`measureLayout(cy, layout)` 可以单独给出这些位置。

布局不会被缩放去适配之前的范围。只缩小位置而不缩小节点，节点就会挤在一起：早先的版本把一个横向很长的流向布局塞进了同心圆布局占据的方块里，结果有四对节点重叠。

`relayout(cy, layout)` 能在任何图上做同样的事。它只对可见的节点布局，所以筛选器隐藏了一部分节点之后，可以单独为剩下的节点布局。被隐藏的节点保持原位，等筛选取消后再出现。

Causal Explorer 提供了四种布局：原始位置、针对当前节点的力导向布局、按中心性排列的同心圆，以及从左到右的流向布局。

## 局限

锚定位置是精确的，但仍可能有少量重叠。如果标签在版本之间变长，节点会变宽，而它又不能离开原来的位置。两张图也各自适配边界，所以即使坐标相同，打开时的缩放比例也可能不同。
