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

## 选择与探索

单击节点可选中它，并在侧栏阅读详情。搜索会选择并定位节点。单击空白画布或使用“清除选择”取消选择。按住 Shift 单击或拖出选择框可多选节点；可达的选择之间会通过有向路径连接。

在侧栏中配置反馈回路搜索、选择回路或设置路径端点。选择节点后，回路列表会限定到该节点；范围控件可切换到全部节点。

多选会用稀疏的有向路径连接可达节点，不保证得到全局最小网络。无法连接的选择仍保持高亮。

## 长按菜单

1. 长按节点约 400 毫秒打开探索菜单。在菜单打开前移动指针，会拖动节点。
2. 指向邻接节点可预览方向。单击后沿该方向前进，菜单移到该节点，走过的路径保持高亮。松开用于打开菜单的那次按压，也会提交当前预览。
3. 继续经过邻接节点可延长路径，节点上的编号表示经过顺序。已经走过的连线不会再次提供。
4. 按 Escape 或单击菜单有效区域之外可关闭菜单，保留已提交的选择和路径。再次单击空白画布可清除它们。

步数环可为当前选择预览更大的邻域，`graphOptions.maxDepth` 控制可用深度。选择和悬停从 `defaultDepth` 开始。

## 键盘与详情

图获得焦点后，方向键移动节点光标，Enter 或空格选择节点。Shift+F10 或菜单键可为光标节点或单个选中节点打开菜单。使用 Tab 移动到控件，Enter 或空格激活。Escape 退出当前交互层，“清除选择”重置所有交互状态。

节点详情和出处显示在侧栏中。没有侧栏时，可使用 `renderNodeInfo` / `renderInfo` 显示详情卡片。普通悬停移到其他位置时，选中的路径或连线仍保持高亮；临时路径预览优先生效，直到预览结束。

## 选项

| 选项 | 默认值 | 作用 |
| :--- | :--- | :--- |
| `maxSelected` | `Infinity` | 可同时选中的节点数，超出时移除最早选中的节点 |
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
| `depth`、`setDepth(steps)` | 当前悬停或选择高亮到几条连线之外；下一次选择重新从 `defaultDepth` 开始 |
| `defaultDepth`、`setDefaultDepth(steps)` | 每次新悬停或选择默认高亮几步，未设置时为 1；`DepthControl` 设置的就是它 |
| `announcement` | 实时区域的文字 |
| `toggle(id)` | 选中或取消选中节点 |
| `focus(id)` | 选中节点并把视图移到它 |
| `clear()` | 一次清除全部交互状态 |
| `dismiss()` | 退出当前交互层 |
| `keepSelected(test)` | 移除未通过检查的选中节点，比如筛选之后 |
| `toggleRoute(route)` | 高亮 `findFeedbackLoops` 返回的回路或 `findCausalPaths` 返回的路径 |
| `zoomIn()`、`zoomOut()`、`fit()` | 移动视图 |
| `cy` | Cytoscape 实例的 ref，用于其他操作 |

## 两张图

每个 hook 控制一张图。做对比时，为每张图使用一个 hook，并通过 `CompareView` 的 `onReady` 连接，它还会传入快照 ID。`apps/perspectiva` 就是这样做的。

### 布局加载

首次绘图和切换布局会先显示加载提示，再开始计算，布局完成后清除。再次切换会取代旧任务，失败时提供重试；切回已有布局时复用缓存位置。可见节点达到 50 个时，布局计算在独立 Web Worker 中运行，主线程只应用位置并播放过渡。取消布局会终止 worker，切换布局会丢弃旧结果；预设或缓存位置无需重新计算。内置布局保留节点尺寸、间距及中心性参数，不支持的自定义 worker 参数会显示错误，不会悄悄退回主线程计算。
