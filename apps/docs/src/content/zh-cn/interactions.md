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

回路配置、数量、耗时和选择合并在侧栏同一区块。选中节点后显示该节点的回路，也可切回全图范围。路径端点选择同样从侧栏进入；图上菜单只调整步数和遍历相邻节点。

- **普通单击节点**：选择节点并显示详情，不打开菜单。搜索结果也只选择和定位。
- **长按节点约 400 ms**：打开径向菜单并锁定，不移动相机。锁定期间该节点带边框，表示它已被选中。
- 锁定后，越过所选扇区外缘即进入下一步：以选中的邻接节点为新中心，按它的邻接节点实际位置重新划分角度和半径。已走过的路径保持锁定，转向只选择下一段连线；拖回上一层中心附近则退回。排除已经走过的节点，尽头不再打开下一层，步数受 `maxDepth` 限制。单击，或松开锁定菜单的那次按压，会提交最终节点和实际走过的路径，锁定的菜单随之移到该节点。当前中心用无描边的半透明灰色迷你 Sunburst 标记，保持原光晕大小。分段对应邻接节点的实际方向，选中方向加深；它和小号步数提示在进退层级时平滑移向对应节点。扇区范围及其过渡仅在方向调试模式显示。上一段路径持续高亮，当前中心上方仅显示步数，正常模式不显示扇区填色、边界及重复文字；减少动画设置会禁用这些动画。
- **无需一直按住，直接移动**：指向扇区预览目标节点及连接路径，指向回路弧预览回路，指向步数环预览步数。
- **点击画布外部或按 Escape**：退出锁定，菜单关闭、边框消失，选择保留。点击菜单自身的环和按钮不会退出；没有指向目标时单击不做任何事。
- **菜单关闭后单击空白画布**：清除已保留的选择与高亮。
- **长按生效前移动超过 8 px**：按普通节点拖动处理，不打开菜单。Escape 取消按住时的预览并关闭菜单，保留起点。
- **Shift-click / Shift 框选**：继续多选，不触发长按菜单。菜单打开期间仍由模态规则接管。
- **键盘替代**：聚焦图后，对光标或单个已选节点按 Shift+F10 / 菜单键打开菜单，Tab 和 Enter 操作。


## 状态与优先级

| 状态 | 进入 | 行为 | 退出 |
| :--- | :--- | :--- | :--- |
| 浏览 / 单节点选择 | 普通点击或搜索 | Hover 临时高亮，点击确认；详情在侧栏，菜单关闭 | 空白画布或清除选择清空；长按进入菜单 |
| 锁定菜单 | 长按节点约 400 ms；该节点带边框 | 图级模态：底层亮/淡节点和边均不能独立截获操作；按住或不按住都可以移动到相邻节点方向或步数控件进行预览；单击提交，菜单移到到达的节点 | 点击画布外部或按 Escape 关闭菜单并保留选择 |
| 保留高亮 | 在菜单中提交，或点击路线控件 | 保留目标节点、连接路径或回路；普通 hover 不覆盖它 | 单击空白画布/清除选择清空；新选择替换 |
| 多选 | 菜单关闭时 Shift-click 或 Shift 框选 | 不限节点数量；详情展示全部节点，路径仅列出精简的有向最短连接。没有路径的已选节点仍亮着 | Shift-click 移除单个节点；普通点击替换为单节点；空白画布清除 |
| 选择追踪终点 | 菜单中选择 ⤳ | 扇区关闭，选择另一个节点完成；侧栏提示下一步 | Escape、起点或背景取消追踪、保留起点 |
| 边详情 | 菜单关闭时点击边，或侧栏查看连线 | 固定高亮连线和两端节点，无菜单 | 再点同一边、空白画布或清除选择退出 |

菜单关闭与清除选择是两件事。退出锁定只关闭菜单，不会把刚确认的高亮清掉；锁定菜单的那次按压也不会再产生一次普通点击。

预览不修改选择。高亮优先级为：临时路线预览 → 保留的路线/边 → 选中的节点或节点集合 → 普通 hover。菜单打开期间由菜单统一解释指针，Shift 不能绕过模态层；框选和底层节点拖动均暂停。菜单关闭后恢复普通交互。

多选时使用有向最短路径，并按新增边更少、中间节点更少的顺序连接其余节点，优先复用已有路径。这是快速的稀疏连接近似，不保证全局最优。无法连通的节点仍保持选中；最短路径不再受 8 个节点上限限制。

## 菜单控件

| 控件 | 锁定时移动 | 单击，或松开锁定的按压 |
| :--- | :--- | :--- |
| 方向扇区 | 预览邻居及连接路径 | 选择目标节点，保留连接路径高亮 |
| 回路弧 | 预览反馈回路 | 保留起点及回路高亮 |
| 步数环 | 预览邻域深度 | 保留步数与起点选择 |
| ⤳ | 提示追踪路径 | 关闭菜单并进入终点选择 |
| 没有命中控件或扇区 | 回到起点的高亮 | 什么也不做，菜单保持锁定 |

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

多选时使用有向最短路径，并按新增边更少、中间节点更少的顺序连接其余节点，优先复用已有路径。这是快速的稀疏连接近似，不保证全局最优。无法连通的节点仍保持选中；最短路径不再受 8 个节点上限限制。

### 布局加载

首次绘图和切换布局会先显示加载提示，再开始计算，布局完成后清除。再次切换会取代旧任务，失败时提供重试；切回已有布局时复用缓存位置。可见节点达到 50 个时，布局计算在独立 Web Worker 中运行，主线程只应用位置并播放过渡。取消布局会终止 worker，切换布局会丢弃旧结果；预设或缓存位置无需重新计算。内置布局保留节点尺寸、间距及中心性参数，不支持的自定义 worker 参数会显示错误，不会悄悄退回主线程计算。
