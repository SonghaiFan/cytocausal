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

## 动画结束前再次切换

选择另一个快照可以打断正在进行的过渡。`GraphView` 管理过渡生命周期，更新 `snapshotId` 即可，无需自行移除并重建图元素。返回已访问的版本时会复用缓存位置。

直接管理 Cytoscape 实例时，可使用 `transitionToSnapshot`。底层接口见 [Cytoscape 集成 API](/zh-cn/api-cytoscape/)。
