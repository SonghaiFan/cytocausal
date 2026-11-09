---
title: "交互"
---

# 交互

`useCausalGraph` 为图提供常用的交互：选中和悬停节点，高亮原因、结果和回路，以及移动视图。把 `attach` 传给 `onReady` 即可连接：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { createCausalStyle, fcoseLayout, lightTheme, type Positions } from "@cytocausal/cytoscape";
import { GraphView, NodeSearch, useCausalGraph } from "@cytocausal/react";
import { useRef } from "react";

const stylesheet = createCausalStyle(lightTheme);

export function Explorer({ dataset }: { dataset: CausalDataset }) {
  const [snapshot] = dataset.snapshots;
  const graph = useCausalGraph({ maxSelected: 2 });
  const positionCache = useRef<Record<string, Positions>>({});

  return (
    <>
      <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
      <button onClick={graph.zoomIn}>Zoom in</button>
      <button onClick={graph.zoomOut}>Zoom out</button>
      <button onClick={graph.fit}>Fit</button>
      <p>{graph.selected.length} selected</p>
      <GraphView
        dataset={dataset}
        snapshotId={snapshot.id}
        layout={fcoseLayout}
        stylesheet={stylesheet}
        positionCache={positionCache}
        onReady={graph.attach}
      />
    </>
  );
}
```

## 交互效果

| 操作 | 结果 |
| :--- | :--- |
| 悬停节点 | 高亮该节点及其原因和结果 |
| 点击节点 | 保持高亮，并把节点加入 `selected` |
| 再次点击 | 取消选中 |
| 点击空白处 | 清除选中 |

高亮有固定的优先级：回路最高，其次是选中的节点，最后是悬停的节点。所以悬停不会打乱已经选中的内容。

## 键盘

图可以获得键盘焦点。选中功能需要开启 `selectable`，它默认开启。

| 按键 | 结果 |
| :--- | :--- |
| 上、下 | 在所有节点间移动 |
| 右 | 移到当前节点的一个结果 |
| 左 | 移到当前节点的一个原因 |
| Enter、空格 | 选中或取消选中当前节点 |
| Escape | 清除光标和选中 |

左右键只移到第一个原因或结果。其他节点可用上下键到达。

把 `announcement` 放进实时区域，屏幕阅读器就能读出光标的位置：

```tsx
<p role="status" className="cc-sr-only">
  {graph.announcement}
</p>
```

## 选项

| 选项 | 默认值 | 作用 |
| :--- | :--- | :--- |
| `maxSelected` | `1` | 可同时选中的节点数，超出时移除最早选中的节点 |
| `selectable` | `true` | 关闭后由你自己处理点击和悬停 |
| `readableLabels` | `false` | 防止标签重叠，需要在 `createCausalStyle` 中启用 `managedLabels`，且每个节点都有 `score` |
| `focusZoom` | 当前缩放 | `focus` 移动到的缩放级别 |
| `initialSelected` | 无 | 初始选中的节点，比如来自分享链接 |
| `motion` | 主题默认值 | 动画时长 |

## 返回内容

| 名称 | 用途 |
| :--- | :--- |
| `attach` | 传给 `onReady` |
| `selected`、`hovered`、`activeRoute` | 当前状态，可显示在你自己的面板中 |
| `previewRoute(route)` | 临时显示一条路线，比如悬停时，传 `null` 结束 |
| `depth`、`setDepth(steps)` | 高亮延伸到几条连线之外 |
| `announcement` | 实时区域的文字 |
| `toggle(id)` | 选中或取消选中节点 |
| `focus(id)` | 选中节点并把视图移到它 |
| `clear()` | 清除选中和回路 |
| `keepSelected(test)` | 移除未通过检查的选中节点，比如筛选之后 |
| `toggleRoute(route)` | 高亮 `findFeedbackLoops` 返回的回路或 `findCausalPaths` 返回的路径 |
| `zoomIn()`、`zoomOut()`、`fit()` | 移动视图 |
| `cy` | Cytoscape 实例的 ref，用于其他操作 |

## 两张图

每个 hook 控制一张图。做对比时，为每张图使用一个 hook，并通过 `CompareView` 的 `onReady` 连接，它还会传入快照 ID。`apps/perspectiva` 就是这样做的。
