---
title: "Cytoscape API"
---

# Cytoscape API

本参考覆盖当前源码工作区的主要接入 API，package 尚未发布到 npm。其他导出与完整类型以链接的 TypeScript 源码为准。

`import { … } from "@cytocausal/cytoscape"`

本包集成 Cytoscape.js，并非 fork。自行管理渲染生命周期或自定义图行为时使用；React 使用者通常先用上层组件。

## toElements

```ts
toElements(snapshot: Snapshot): { nodes: ElementDefinition[]; edges: ElementDefinition[] }
```

将快照转换为 Cytoscape 元素。先复制 metadata，再设置标准身份字段；根据证据增加 `support` 与 `supportShare`，已知极性生成 `+` / `-` 连线标签。证据本身留在源数据集中。

## createCausalStyle

```ts
createCausalStyle(theme: CausalTheme, options?: CausalStyleOptions): Stylesheet[]
```

| Option | Values / 行为 |
| --- | --- |
| `node` | `"dot" \| "pill"` |
| `link` | `"bezier" \| "flowing" \| "straight"` |
| `sizeByScore` | 按 0–1 的 score 缩放 |
| `weightBySupport` | 按 supportShare 加粗连线 |
| `managedLabels` | 仅显示由标签管理器标记的标签 |
| `zoom` | `"magnify" \| "balanced" \| "spread"` |
| `baseRules` | 应用规则位于交互状态规则之前 |

managedLabels 开启时默认 zoom 为 spread，否则为 magnify。spread/balanced 需要恒定尺寸辅助逻辑，`keepLabelsReadable` 会启用它。直接配置时应遵循主题指南，或使用 React 集成。

## 主题与布局

`lightTheme` 与 `darkTheme` 是 `CausalTheme` 对象。`themeVariables(theme)` 生成 UI CSS 变量。图语义色应与品牌色独立。

| Export | 用途 |
| --- | --- |
| `autoLayout` | 默认自动布局配置 |
| `savedLayout` | `preset`, `fit: true`, `padding: 30` |
| `layouts` | cola, fcose, dagre, breadthfirst, concentric, cose, circle, grid, random |
| `Positions` | `Record<string, {x: number, y: number}>` |
| `alignPositions(positions, counterparts)` | 为对应节点计算位置，合并使用中心位置 |
| `snapshotPositions(cy, snapshot)` | 提取快照节点的当前位置 |
| `relayout(cy, layout, options?)` | 重新布局；可传 positions、motion、onSettled |

## 高亮与视图

| Call | 行为 |
| --- | --- |
| `highlightCausalNeighbours(cy, ids, depth = 1)` | 区分原因、结果与选中节点；空数组清除 |
| `highlightRoute(cy, route)` | `route: {nodes: string[], edges: string[]} \| null` |
| `highlightChanges(cy, marks)` | `Partial<ChangeMarks>`; 空对象清除 |
| `hideExceptContributors(cy, snapshot, names)` | `string[] \| null`; null = 所有人 |
| `focusNode(cy, id, options?)` | 默认 zoom 2；可传 motion |
| `fitNodes(cy, duration = 0)` | 适配节点范围 |
| `zoomBy(cy, factor, duration = 0)` | 相对缩放 |
| `exportImage(cy, fileName, background)` | 浏览器下载 PNG |

这些函数修改 Cytoscape 样式、class 或视图状态。不要让多个独立交互处理器互相覆盖；React hook 会协调这些状态。

## transitionToSnapshot

```ts
transitionToSnapshot(cy, snapshot, {
  counterparts, // Record<string, string[]>
  positions,    // optional Positions
  motion,       // optional CausalMotion
  onSettled,    // required () => void
})
```

将现有实例过渡到新快照。通过 core 的 `followNodes` 计算 counterparts。对应节点移动、新节点淡入、删除节点淡出。没有目标位置时，匹配节点保持锚定，其他节点由 fcose 布局。React 的 `GraphView` 可以通过 `animateSnapshots` 管理此流程。

[style.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/cytoscape/src/style.ts) · [transition.ts](https://github.com/SonghaiFan/cytocausal/blob/main/packages/cytoscape/src/transition.ts) · [主题指南](/zh-cn/theming/) · [布局指南](/zh-cn/stable-layouts/)
