---
title: "版本过渡"
---

# 版本过渡

切换版本时应该能看出变化。重建图做不到这一点，因为屏幕上没有任何内容被保留。启用 `animateSnapshots` 的 `GraphView` 会保留同一张图并对它进行变换：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import { GraphView } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";
import { useRef, useState } from "react";

const stylesheet: Stylesheet[] = [{ selector: "node", style: { label: "data(label)" } }];

export function VersionSwitcher({ dataset }: { dataset: CausalDataset }) {
  const [version, setVersion] = useState("V1");
  const positionCache = useRef<Record<string, Positions>>({});
  return (
    <>
      <button onClick={() => setVersion(version === "V1" ? "final" : "V1")}>Switch</button>
      <GraphView
        dataset={dataset}
        snapshotId={version}
        layout={fcoseLayout}
        stylesheet={stylesheet}
        positionCache={positionCache}
        animateSnapshots
      />
    </>
  );
}
```

| 节点 | 变化 |
| :--- | :--- |
| 有对应节点 | 从旧位置移动到新位置 |
| 由多个节点合并而来 | 从来源节点的中心出发 |
| 本版本新增 | 在目标位置淡入 |
| 本版本已不存在 | 淡出后移除 |

边采用交叉淡入淡出，因为新旧连接很少能一一对应。

## 已知目标和未知目标

如果某个版本的位置已缓存，`transitionToSnapshot` 会直接动画到这些位置，所以来回切换不会漂移。如果没有缓存，它会钉住有对应关系的节点，由 fcose 放置其余节点。结果随后被缓存，之后的切换就是精确的。

## 被打断的过渡

用户点击的速度比动画快，我们遇到的每个问题都来自过渡被打断。下面三点都已在 `transitionToSnapshot` 中处理，也适用于任何 Cytoscape 动画代码。

### 停止布局会触发 layoutstop

`layout.stop()` 会立即触发 `layoutstop`，而此时节点还在移动。如果监听器保存位置，保存的就是错误的位置。过渡会在停止上一个过渡之前，先把自己标记为当前过渡，监听器只在其过渡仍是当前过渡时才运行。

### 被打断的动画不会完成

`stop()` 之后，动画的 `complete` 回调不会执行。放在其中的清理工作会被跳过，图上就会留下多余元素。请使用定时器，并检查过渡是否仍是当前过渡。

### 动画池按 ID 跟踪元素

移除一个元素后，再添加一个相同 ID 的新元素，新元素的动画会被搁置。Cytoscape 的动画池仍持有被移除的元素，所以认为新元素已经注册，也就不会运行它的动画。该元素会一直被标记为正在动画。

解决方法是打断时不移除残留元素。它们留在图中，由下一次过渡复用或淡出。

## 测试打断场景

这些 bug 要么在屏幕上看起来正常，要么只在快速点击时出现。请测试你看不到的部分：快速切换之后，检查没有元素仍在动画、没有元素半透明，并且位置与第一次访问时一致。`apps/perspectiva/e2e/graph.spec.ts` 对每个数据集都做了这些检查。
