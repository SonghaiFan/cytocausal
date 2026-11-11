---
title: "规模与性能"
---

# 规模与性能

图的响应速度取决于节点和边的数量、标签密度、样式、布局和设备。请使用有代表性的数据，在目标设备上评估首次渲染、缩放、选择和布局切换。

## 不要在页面加载时运行慢布局

如果节点已有保存的位置，可使用 preset 布局，避免加载时重新计算：

```ts
import type { LayoutOptions } from "cytoscape";

export const savedLayout = { name: "preset", fit: true, padding: 30 } as LayoutOptions;
```

选择合适的坐标尺度，使节点和标签在初始适配视图中保持可读。

## 标签需要碰撞处理

`min-zoomed-font-size` 可以隐藏小字号文字，但不能防止标签重叠。密集图还需要碰撞处理。

在 [`useCausalGraph`](/zh-cn/interactions/) 中启用 `readableLabels`，即可使用 `keepLabelsReadable`。标签按选择、键盘焦点、高亮路径或回路、因果邻居和中心性确定优先级，被调暗的节点为当前选择让出空间。

空间允许时，标签会避开其他节点和标签。即使没有无碰撞的位置，选中节点仍保留标签。托管文字在缩放时保持固定的屏幕尺寸。

## 检查可读性

检查初始视图、不同缩放级别，以及邻居较多的节点选择。确认标签是否重叠、选中节点是否容易辨认、交互是否及时响应。帧率高并不代表图可读。
