---
title: "组件"
---

# 组件

`CausalWorkspace` 用一行代码提供完整界面。其中每一部分也都是可以单独使用的组件。

## 完整界面

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { CausalWorkspace } from "@cytocausal/react";

export function App({ dataset }: { dataset: CausalDataset }) {
  return <CausalWorkspace dataset={dataset} title="My graph" />;
}
```

在根布局中引入一次样式：

```tsx
import "@cytocausal/react/styles.css";
```

| 属性 | 默认值 | 作用 |
| :--- | :--- | :--- |
| `dataset` | 必需 | 要显示的图 |
| `title` | 无 | 侧边栏顶部的文字 |
| `labels` | 英文 | 要替换的文字 |
| `themes` | `lightTheme`、`darkTheme` | 浅色和深色[主题](/zh-cn/theming/) |
| `styleOptions` | 无 | `createCausalStyle` 的选项 |
| `layout` | 自动 | 所有节点都有位置时使用已保存的位置，否则自动布局 |
| `layouts`、`initialLayout` | 无、第一个 | 可供选择的具名布局，取代 `layout`。工作区会显示切换按钮，分享的链接会保留所选布局 |
| `maxSelected` | `2` | 可同时选中的节点数。选中两个节点时列出它们之间的路径 |
| `scheme` | 跟随系统 | 指定 `light` 或 `dark`，并隐藏切换按钮 |
| `initialVersion`、`initialSelected` | 第一个快照、无 | 初始状态 |
| `shareInUrl` | `true` | 把版本和选中项保存在页面地址中，打开链接时恢复同样的视图 |
| `children` | 无 | 放在侧边栏末尾的额外面板 |

请把 `labels`、`themes` 和 `styleOptions` 定义在组件外部，让它们在多次渲染之间保持不变。

节点超过 60 个时，工作区只列出最多 6 个节点的回路，因为完整列表可能非常庞大。数量后面的 `+` 表示可能还有更多。传入 `loopOptions`（比如 `{ maxLength: 8, limit: 200 }`）可以自己设定上限。

## 自选组件

把需要的组件放进 `CausalProvider`。它保存数据集、版本、选中项和主题，组件会自动连接，不需要传属性：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import {
  CausalGraph,
  CausalProvider,
  LoopList,
  NodeSearch,
  SelectionPanel,
  VersionSwitcher,
} from "@cytocausal/react";

export function MyApp({ dataset }: { dataset: CausalDataset }) {
  return (
    <CausalProvider dataset={dataset} className="cc-workspace">
      <CausalGraph />
      <aside className="cc-sidebar">
        <NodeSearch />
        <VersionSwitcher />
        <SelectionPanel />
        <LoopList />
      </aside>
    </CausalProvider>
  );
}
```

| 组件 | 显示内容 |
| :--- | :--- |
| `CausalGraph` | 图和缩放按钮，子元素显示在图上方 |
| `NodeSearch` | 搜索框和结果 |
| `VersionSwitcher` | 切换快照的按钮 |
| `LayoutSwitcher` | 在 provider 的 `layouts` 之间选择，最多四个时显示为按钮，更多时显示为菜单 |
| `SelectionPanel` | 先显示提示，选中后显示节点详情和节点间的路径 |
| `NodeDetails` | 单个节点的原因、结果和证据，每条连线旁边有打开它的按钮 |
| `LinkDetails` | 连线的提出者和他们的证据，以及在极性上与它有分歧的连线 |
| `ContributorFilter` | 选择显示哪些人提出的节点和连线。快照有两位提出者时才会出现 |
| `PathList` | 两个节点之间双向的路径 |
| `LoopList` | 反馈回路，并标记增强或平衡 |
| `VersionDiff` | 两个快照之间的变化 |
| `DepthControl` | 高亮的延伸范围 |
| `Legend` | 图中标记的说明：色块、轮廓或符号 |
| `ZoomControls` | 缩放和适应按钮 |
| `Segmented` | 从几个选项中选一个，显示为相连的按钮 |
| `SidebarHeader` | 标题、副标题、链接和深浅色切换 |

悬停 `LoopList` 或 `PathList` 的一行会在图上预览，点击后保持高亮。

`VersionSwitcher`、`Legend` 和 `DepthControl` 支持 `bare`，去掉外层面板，可以直接放在图上。

悬停在连线上时，`CausalGraph` 会显示它的提出者。像节点的 `renderTooltip` 一样，传入 `renderLinkTooltip` 可以改成别的内容。传入 `styleOptions={{ weightBySupport: true }}`（定义在组件外部）会让提出人数越多的连线越粗。

大型图可以给 `CausalProvider` 传 `graphOptions`，比如 `{ readableLabels: true }`，给 `CausalGraph` 传 `maxZoom`。`SelectionPanel` 的 `loopOptions` 会列出经过每个节点的回路。

### 读取状态

在 provider 内任何位置调用 `useCausal`：

```tsx
"use client";
import { useCausal } from "@cytocausal/react";

export function Summary() {
  const { snapshot, version, graph, exportImage } = useCausal();
  return (
    <button type="button" onClick={exportImage}>
      Export {version}: {snapshot.nodes.length} nodes, {graph.selected.length} selected
    </button>
  );
}
```

它还提供 `setVersion`、`loops`、`theme`、`scheme`、`toggleScheme`、`showChanges`、`setShowChanges` 和 `copyLink`。

### 不用 provider

每个组件也可以通过属性传数据，属性优先于 provider。当 provider 不适合你的布局时使用，比如两张图各有自己的选中项。用 [`useCausalGraph`](/zh-cn/interactions/) 连接它们：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { GraphView, NodeSearch, useCausalGraph, ZoomControls } from "@cytocausal/react";

export function MyGraph({ dataset }: { dataset: CausalDataset }) {
  const [snapshot] = dataset.snapshots;
  const graph = useCausalGraph();

  return (
    <div className="cc-workspace">
      <div className="cc-graph">
        <GraphView dataset={dataset} snapshotId={snapshot.id} onReady={graph.attach} />
        <ZoomControls graph={graph} />
      </div>
      <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
    </div>
  );
}
```

`GraphView` 只需要 `dataset` 和 `snapshotId`，`layout`、`stylesheet` 和 `positionCache` 都有默认值。`apps/explorer` 和 `apps/perspectiva` 就是这样构建的。

## 导出图片

`CausalWorkspace` 自带 **Export PNG** 按钮。如需自己添加，可调用 `@cytocausal/cytoscape` 的 `exportImage`：

```ts
import type { Core } from "cytoscape";
import { exportImage, lightTheme } from "@cytocausal/cytoscape";

export function download(cy: Core) {
  exportImage(cy, "my-graph", lightTheme.colors.background);
}
```

## 修改文字

所有文字都可以替换，比如翻译界面：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { CausalWorkspace, type CausalLabels } from "@cytocausal/react";

const labels: Partial<CausalLabels> = {
  search: "搜索节点…",
  matches: (count) => `${count} 个结果`,
  causedBy: "原因",
  leadsTo: "结果",
};

export function App({ dataset }: { dataset: CausalDataset }) {
  return <CausalWorkspace dataset={dataset} labels={labels} />;
}
```

如果不使用 `CausalWorkspace`，请用 `CausalLabelsProvider` 包裹组件。

## 组件样式

组件使用 `cc-*` 类名和主题的 `--cc-*` 变量，所以不需要 Tailwind。大多数组件都接受 `className`。要修改样式，在你自己的 CSS 中覆盖对应的类即可。
