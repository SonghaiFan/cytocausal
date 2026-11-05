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
| `maxSelected` | `2` | 可同时选中的节点数。选中两个节点时列出它们之间的路径 |
| `shareInUrl` | `true` | 把版本和选中项保存在页面地址中，打开链接时恢复同样的视图 |
| `children` | 无 | 放在侧边栏末尾的额外面板 |

请把 `labels`、`themes` 和 `styleOptions` 定义在组件外部，让它们在多次渲染之间保持不变。

节点超过 60 个时，工作区只列出最多 6 个节点的回路，因为完整列表可能非常庞大。数量后面的 `+` 表示可能还有更多。

## 自选组件

| 组件 | 显示内容 |
| :--- | :--- |
| `GraphView` | 一张图 |
| `CompareView` | 并排显示两个快照，相同节点对齐 |
| `NodeSearch` | 搜索框和结果 |
| `NodeDetails` | 节点的原因、结果、回路和证据 |
| `LoopList` | 反馈回路，标记为增强或平衡 |
| `VersionSwitcher` | 切换快照的按钮 |
| `Legend` | 颜色图例 |
| `ZoomControls` | 缩放和适配按钮 |
| `NodeTooltip` | 悬停预览，用于 `renderTooltip` |

用 [`useCausalGraph`](/zh-cn/interactions/) 把它们连接起来：

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { createCausalStyle, fcoseLayout, lightTheme, type Positions } from "@cytocausal/cytoscape";
import {
  CausalRoot,
  GraphView,
  Legend,
  NodeDetails,
  NodeSearch,
  useCausalGraph,
  ZoomControls,
} from "@cytocausal/react";
import { useRef } from "react";

const stylesheet = createCausalStyle(lightTheme);

export function MyApp({ dataset }: { dataset: CausalDataset }) {
  const [snapshot] = dataset.snapshots;
  const graph = useCausalGraph();
  const positionCache = useRef<Record<string, Positions>>({});

  return (
    <CausalRoot theme={lightTheme} className="cc-workspace">
      <div className="cc-graph">
        <GraphView
          dataset={dataset}
          snapshotId={snapshot.id}
          layout={fcoseLayout}
          stylesheet={stylesheet}
          positionCache={positionCache}
          onReady={graph.attach}
        />
        <ZoomControls graph={graph} />
      </div>
      <aside className="cc-sidebar">
        <NodeSearch nodes={snapshot.nodes} onSelect={graph.focus} />
        <Legend />
        {graph.selected.map((id) => (
          <NodeDetails
            key={id}
            snapshot={snapshot}
            nodeId={id}
            onSelect={graph.focus}
            onClose={() => graph.toggle(id)}
          />
        ))}
      </aside>
    </CausalRoot>
  );
}
```

`apps/explorer` 和 `apps/perspectiva` 就是这样构建的，各自只使用需要的部分。

## 路径、深度和变化

这三个面板都配合 `useCausalGraph` 使用：

```tsx
"use client";
import type { CausalDataset, Snapshot } from "@cytocausal/core";
import { DepthControl, PathList, useCausalGraph, VersionDiff } from "@cytocausal/react";

export function Panels({ dataset, snapshot }: { dataset: CausalDataset; snapshot: Snapshot }) {
  const graph = useCausalGraph({ maxSelected: 2 });
  const [from, to] = graph.selected;

  return (
    <>
      <DepthControl value={graph.depth} onChange={graph.setDepth} />
      {to && (
        <PathList
          snapshot={snapshot}
          from={from}
          to={to}
          active={graph.activeLoop}
          onToggle={graph.toggleLoop}
        />
      )}
      <VersionDiff dataset={dataset} from="V1" to="final" />
    </>
  );
}
```

`PathList` 显示两个方向，因为 A 能影响 B 并不代表 B 能影响 A。传入 `shown` 和 `onToggle` 后，`VersionDiff` 会显示 **Show on graph** 按钮。也可以用 `highlightChanges(cy, added, removed)` 自己标记变化。

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
