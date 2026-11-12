---
title: "React API"
---

# React API

本参考覆盖当前源码工作区的主要接入 API，package 尚未发布到 npm。其他导出与完整类型以链接的 TypeScript 源码为准。

`import { … } from "@cytocausal/react"`

导入一次 `@cytocausal/react/styles.css`。当前 package 的 peer dependency 是 React 19。图视图需要浏览器与明确容器尺寸，请保留 starter 的客户端加载边界。

## CausalWorkspace / CausalProvider

`CausalWorkspace` 组合图与侧栏，继承 provider 的属性（除 `children` 和 `className`），并提供 `title`、侧栏扩展 `children`、`depthControl`（默认 false）以及调试用 `showDirections`。`CausalProvider` 向自定义子组件共享状态，并接受 `className`。

| Prop | 默认与含义 |
| --- | --- |
| `dataset` | 必填，至少一个快照 |
| `initialVersion` | 第一个快照 |
| `initialSelected`, `initialLink` | 默认未选；连线选择优先于节点 |
| `maxSelected` | `Infinity` |
| `initialBaseline` | `"previous"`; `"first"` / snapshot id |
| `shareInUrl` | Workspace `true`; Provider `false` |
| `layout` | 所有节点有位置时使用保存位置，否则自动布局 |
| `layouts`, `initialLayout` | 命名布局替代 `layout`；默认第一个名称 |
| `themes`, `scheme` | 默认明暗主题；未指定 scheme 时跟随系统 |
| `labels` | `Partial<CausalLabels>` |
| `styleOptions` | `CausalStyleOptions` |
| `graphOptions` | `readableLabels`, `focusZoom`, `maxDepth`, `defaultDepth` |
| `loopOptions` | 未提供 loopSettings 时，初始 maxLength 4、limit 1000 |
| `loopSettings` | `{ title, description, maxLength, limit }` |

initial 属性只用于初始化，不是受控值。配置对象应在多次渲染间保持稳定。`shareInUrl` 读写当前地址中的视图状态，嵌入式示例应关闭。更换整个已加载数据集时，用新的 key 重新挂载。

## useCausal

```tsx
const { snapshot, version, setVersion, graph, exportImage } = useCausal();
```

在 `CausalProvider` 内调用。`setVersion(id, { focus })` 可以在换版本时跟随节点或连线。`graph` 提供选择与导航，`exportImage()` 下载图。其他状态包括 `dataset`、`issues`、`scheme`、`theme`、`baseline`、贡献者过滤、`showChanges` 与 URL 分享。完整字段见推导出的 `CausalState` 类型。

## 组合组件

| Component | 用途 |
| --- | --- |
| `CausalGraph` | 连接 provider 的图，包含径向菜单与缩放控件 |
| `NodeSearch`, `SelectionPanel` | 搜索节点；查看选择详情与路径 |
| `NodeDetails`, `LinkDetails` | 查看节点、连线与证据 |
| `VersionSwitcher`, `VersionTimeline`, `VersionDiff` | 切换版本并检查变化 |
| `ContributorFilter` | 过滤贡献者内容 |
| `CyclePanel`, `LoopList`, `PathList` | 回路控制与路径结果 |
| `Legend`, `DepthControl`, `LayoutSwitcher`, `ZoomControls` | 图控件 |

[完整组合示例](/zh-cn/example-compose/) · [组件指南](/zh-cn/components/)

## GraphView / useCausalGraph

```tsx
const graph = useCausalGraph();
<GraphView dataset={dataset} snapshotId="draft" onReady={graph.attach} />
```

`GraphView` 必填 `dataset` 与 `snapshotId`，管理 Cytoscape 实例生命周期。`onReady` 接收每个新实例。`useCausalGraph` 管理交互状态，不要求 provider；将 `attach` 连接到 `onReady`。

| GraphView prop | Default / type |
| --- | --- |
| `layout` | `autoLayout`; 稳定对象 |
| `stylesheet` | `createCausalStyle(lightTheme)` |
| `maxZoom` | `2` |
| `animateSnapshots`, `animateLayouts` | `false` |
| `positionCache` | `RefObject<Record<string, Positions>>` |
| `anchorPositions` | `Positions` |
| `onLayoutComplete` | `(positions: Positions) => void` |
| `renderTooltip`, `renderLinkTooltip` | 自定义预览 |
| `tooltipDelay` | `300` ms |

Hook 的 `maxSelected` 默认不限制，`selectable` 默认 true，`maxDepth` 默认 2，`defaultDepth` 默认 1。`focusZoom` 可选，省略时 focus 不改变缩放。可用返回的 `focus`、`selected`、`selectedLink`、`clear` 与路径控制连接界面。

## CompareView

```tsx
<CompareView dataset={dataset} left="draft" right="reviewed" />
```

需要两个快照 ID。用 `followNodes` 匹配节点，将右图对齐左图，默认同步视图移动（`sync=true`）。`format(id)` 设置面板标签，`onReady(cy, snapshotId)` 暴露实例。也接受共享的 layout、stylesheet、motion、maxZoom 与 positionCache。

[CausalProvider.tsx](https://github.com/SonghaiFan/cytocausal/blob/main/packages/react/src/CausalProvider.tsx) · [GraphView.tsx](https://github.com/SonghaiFan/cytocausal/blob/main/packages/react/src/GraphView.tsx) · [CompareView.tsx](https://github.com/SonghaiFan/cytocausal/blob/main/packages/react/src/CompareView.tsx)

## CausalEditor

仅浏览器渲染的 Author / Explore 编辑器。除共享样式外引入 `@cytocausal/react/editor.css`。为宿主设置高度（例如 720px）；桌面最小高度为 560px。

| 属性 | 约定 |
| --- | --- |
| `initialDataset` | 必填，至少一个快照；只校验并克隆一次。后续属性变化会被忽略。 |
| `onChange(dataset)` | 编辑、撤销、重做后返回独立文档副本。初始化、仅选择、仅切换模式或快照不通知。不执行保存。 |
| `initialNodeStyle` | 默认 `"text"`，可选 `"dot"`；仅作为初始值。 |
| `onNodeStyleChange(style)` | 外观偏好回调，不是文档编辑。 |
| `header(api)`、`toolbar(api)` | 通过当前 `CausalEditorApi` 渲染宿主控件。 |
| `footer`、`className` | 可选 React 内容和编辑器外层类名。 |
| `ref` | 暴露 `CausalEditorApi` 的 React 19 ref。 |

API 提供：

- `getDataset()`：返回包含创作位置的独立文档副本。
- `replaceDataset(dataset)`：校验、取消待完成手势，将替换作为一次可撤销编辑。触发 `onChange`，选择首个快照。
- `replaceDataset(dataset, { resetHistory: true })`：开始新会话，清除待完成编辑、选择、视角和历史，保留节点外观。不触发 `onChange`，因为宿主已拥有加载数据。无效输入在替换前抛错。
- `renameDataset(name)`：提交去除首尾空白后的非空名称。
- `undo()`、`redo()`、`canUndo`、`canRedo`：Author 模式可用的文档历史。最多保留 50 步已提交编辑；新编辑清除重做分支。

选择、视角和历史属于各自挂载的编辑器。切换模式保留选择与视角；Explore 中的临时位置在返回时恢复为创作位置。历史不持久化。不要在每次 `onChange` 后调用 `replaceDataset`：更新宿主状态或在外部保存即可，不必重置编辑会话。
