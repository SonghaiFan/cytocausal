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
| 点击连线 | 把它选为 `selectedLink`，并高亮它和两端节点，同时取消已选中的节点 |
| 点击空白处 | 清除选中 |

高亮有固定的优先级：回路最高，其次是选中的节点，最后是悬停的节点。所以悬停不会打乱已经选中的内容。

## 环形菜单

选中一个节点后，它周围会出现一个环形菜单：

| 环 | 作用 |
| :--- | :--- |
| 最内圈的扇形 | 每个相连的节点一个扇形，扇形位于它在图上所在的方向。箭头跟随连线：指向外表示结果，指向所选节点表示原因，两者都是时显示双向箭头。指向扇形可以预览这条连线，选择它就会走到那个节点：那个节点成为新的选中项，菜单随之移动 |
| 两个细环 | 高亮延伸的步数：指向其中一个可以预览 2 步或 3 步，选择它则保持下来。选择当前最深的那一环会退回一步 |
| 最外圈的弧 | 先是经过该节点的反馈回路，标有 `R` 或 `B`；然后用浅一级的颜色列出不经过它、但落在当前步数范围内的回路。指向可以预览回路，选择后保持高亮 |

菜单只用对比度表示状态，所以强调色只留给节点本身。每一项都可以用 Tab 到达，用 Enter 或空格选择，按 Escape 会清除选中。菜单下方的说明文字会显示指针或键盘焦点所在的项。

在大型图上，可以给 `CausalGraph` 传入 `loopOptions` 来限制回路搜索。不使用 provider 时，在图旁边渲染 `<RadialMenu graph={graph} snapshot={snapshot} />` 即可，它会自动定位到选中的节点上。

### 提示框与菜单

提示框回答"这是什么？"，用于还没选中的节点；菜单回答"从这里能去哪里？"，用于已选中的节点。两者从不同时出现：

| 指针位置 | 显示的内容 |
| :--- | :--- |
| 在选中的节点上，或菜单圆圈内的任何位置 | 只显示菜单的说明文字 |
| 在扇形或弧上 | 说明文字，并在图上高亮对应的连线或回路 |
| 在其他节点或连线上 | 它的提示框，显示在指针旁边、远离菜单的一侧 |
| 在图上移动时 | 指针停留 300 毫秒后才显示，避免提示框闪烁。可以通过 `GraphView` 的 `tooltipDelay` 修改 |
| 在触屏上 | 没有悬停，所以不显示提示框。点按即选中，详细信息在侧栏中 |

## 键盘

图可以获得键盘焦点。选中功能需要开启 `selectable`，它默认开启。

| 按键 | 结果 |
| :--- | :--- |
| 上、下 | 在所有节点间移动 |
| 右 | 移到当前节点的一个结果 |
| 左 | 移到当前节点的一个原因 |
| Enter、空格 | 选中或取消选中当前节点 |
| Escape | 清除光标和选中 |

用键盘查看连线时，先选中一个节点，再使用它每个原因和结果旁边的连线按钮。在你自己的代码里，可以用 `toggleLink` 做同样的事。

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
