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

## 长按菜单

- **普通单击节点**：选择节点并显示详情，不打开菜单。搜索结果也只选择和定位。
- **长按节点约 400 ms**：打开径向菜单，不移动相机。
- 按住拖动时，角度选择连线。每个方向保留按邻接节点距离确定的原扇区半径：原扇区内为 step 1，越过外缘为 step 2，后续边界按对应因果层最远节点的实际距离加原有外侧留白计算，最高为 `maxDepth`。折返的层共用已有范围；没有后续层时不增加距离分区。仅在当前角度扇区显示距离分区和步数高亮，往回拖则递减。
- **保持按下并移动**：指向扇区预览目标节点及连接路径，指向回路弧预览回路，指向步数环预览步数。
- **松开鼠标**：提交当前预览并关闭菜单，保留节点/连线/回路高亮；未指向其他项时保留起点节点。
- **单击空白画布**：清除已保留的选择与高亮。
- **长按生效前移动超过 8 px**：按普通节点拖动处理，不打开菜单。Escape 取消按住时的预览并关闭菜单，保留起点。
- **Shift-click / Shift 框选**：继续多选，不触发长按菜单。菜单打开期间仍由模态规则接管。
- **键盘替代**：聚焦图后，对光标或单个已选节点按 Shift+F10 / 菜单键打开菜单，Tab 和 Enter 操作。

## 状态与优先级

| 状态 | 进入 | 行为 | 退出 |
| :--- | :--- | :--- | :--- |
| 浏览 / 单节点选择 | 普通点击或搜索 | Hover 临时高亮，点击确认；详情在侧栏，菜单关闭 | 空白画布或清除选择清空；长按进入菜单 |
| 按住菜单 | 长按节点约 400 ms | 图级模态：底层亮/淡节点和边均不能独立截获操作；保持按下移动到扇区、回路、步数控件进行预览 | 松开关闭菜单并保留当前选择；Escape 放弃预览、保留起点 |
| 保留高亮 | 从菜单松开，或点击路线控件 | 保留目标节点、连接路径或回路；普通 hover 不覆盖它 | 单击空白画布/清除选择清空；新选择替换 |
| 多选 | 菜单关闭时 Shift-click 或 Shift 框选 | 不限节点数量；详情展示全部节点，路径按每对节点的两个方向列出。没有路径的已选节点仍亮着 | Shift-click 移除单个节点；普通点击替换为单节点；空白画布清除 |
| 选择追踪终点 | 菜单中选择 ⤳ | 扇区关闭，选择另一个节点完成；侧栏提示下一步 | Escape、起点或背景取消追踪、保留起点 |
| 边详情 | 菜单关闭时点击边，或侧栏查看连线 | 固定高亮连线和两端节点，无菜单 | 再点同一边、空白画布或清除选择退出 |

菜单关闭与清除选择是两件事。松开只完成前者，不会把刚确认的高亮清掉，也不会再产生一次普通点击。

预览不修改选择。高亮优先级为：临时路线预览 → 保留的路线/边 → 选中的节点或节点集合 → 普通 hover。菜单打开期间由菜单统一解释指针，Shift 不能绕过模态层；框选和底层节点拖动均暂停。菜单关闭后恢复普通交互。

每对节点的路径搜索沿用默认上限：每条最多 8 个节点、每方向最多 50 条；`+` 标明受限结果。选择数量没有默认上限，嵌入应用仍可显式设置 `maxSelected`。

## 菜单控件

| 控件 | 按住移动时 | 松开时 |
| :--- | :--- | :--- |
| 方向扇区 | 预览邻居及连接路径 | 选择目标节点，保留连接路径高亮 |
| 回路弧 | 预览反馈回路 | 保留起点及回路高亮 |
| 步数环 | 预览邻域深度 | 保留步数与起点选择 |
| ⤳ | 提示追踪路径 | 关闭菜单并进入终点选择 |
| 没有命中控件或扇区 | 回到起点的高亮 | 关闭菜单并保留起点 |

扇区按真实方位的角度 Voronoi 区域划分，最多向邻居两侧各延伸 60°，从中心节点边缘到稍过邻居。默认 `maxDepth: 2`，只有一个两步环；可由 `graphOptions.maxDepth` 配置。

## 键盘和详情

图获得焦点后，方向键移动节点光标，Enter/空格确认选择。Shift+F10 或菜单键为当前光标/单个选中节点打开键盘菜单；Tab 到达控件，Enter/空格确认。键盘菜单没有鼠标按住过程，因此 Escape 按层退出：先取消追踪或固定路线，再清除选择。清除选择按钮始终退出全部。

节点默认没有 hover tooltip；名称在图上，详情和证据在侧栏。菜单背景不显示边 tooltip。没有侧栏时可使用 `renderNodeInfo` / `renderInfo` 显示详情卡片。搜索和侧栏仍是明确命令；这不是禁用整页其他内容的弹窗。

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
| `depth`、`setDepth(steps)` | 高亮延伸到几条连线之外 |
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

多选时，每个有序节点对沿用现有路径搜索上限：每条路径最多 8 个节点、每个方向最多 50 条路径。数量后的 `+` 表示结果受限。图上合并这些路径，同时保留不连通的已选节点高亮。
