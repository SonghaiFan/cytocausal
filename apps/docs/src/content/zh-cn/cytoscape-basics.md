---
title: "Cytoscape.js 基础与扩展"
---

# Cytoscape.js 基础与扩展

这是[快速开始](/zh-cn/getting-started/)之后的可选基础知识。直接使用 `CausalWorkspace` 不需要先学底层 API；需要理解选择器、自定义样式或扩展图交互时，可以阅读本篇。

Cytoscape.js 是 cytocausal 底层的图渲染与交互库。这里的“语法”主要指 JavaScript 对象、选择器和 API 调用。cytocausal 在此基础上增加因果数据模型、出处、版本比较、因果分析和 React 组件。

## 同一张小图，两种实现

两个示例使用同一个说明性模型，代码中的标签统一使用英文，方便逐项对照：

```text
Rain（降雨）──(+)──▶ Soil water（土壤水分）──(−)──▶ Plant water stress（植物水分胁迫）
```

在其他条件保持不变的假设下，降雨增加土壤水分，土壤水分增加则减轻植物水分胁迫。这些关系是示例输入的假设，画出图并不能证明因果关系。正负表示影响方向，不表示结果的好坏。两种实现的节点 ID、连线和极性完全相同，工作区额外提供自己的样式和控件。

请在快速开始介绍的现有工作区中运行示例，cytocausal 包目前尚未发布到 npm。在 Next.js 中，两种图组件都应通过 [React 生命周期](/zh-cn/react-lifecycle/)中的浏览器端加载器加载。

## 原生 Cytoscape.js 写法

这个组件管理容器、图实例、样式和事件监听。容器需要非零高度；React 卸载组件时，清理函数会销毁实例。

```tsx
"use client";

import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";

export function NativeGraph() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: [
        { data: { id: "rain", label: "Rain", category: "weather" } },
        { data: { id: "water", label: "Soil water" } },
        { data: { id: "stress", label: "Plant water stress" } },
        { data: { id: "rain-water", source: "rain", target: "water", polarity: "positive", label: "+" } },
        { data: { id: "water-stress", source: "water", target: "stress", polarity: "negative", label: "−" } },
      ],
      style: [
        { selector: "node", style: { label: "data(label)", "background-color": "#555" } },
        { selector: "edge", style: {
          label: "data(label)", "curve-style": "bezier",
          "target-arrow-shape": "triangle", "line-color": "#777", "target-arrow-color": "#777",
        } },
        { selector: 'edge[polarity = "negative"]', style: { "line-style": "dashed" } },
        { selector: 'node[category = "weather"]', style: { "border-width": 2, "border-color": "#777" } },
      ],
      layout: { name: "breadthfirst", directed: true, padding: 40 },
    });
    const onTap = (event: cytoscape.EventObject) => console.log(event.target.id());
    cy.on("tap", "node", onTap);
    return () => {
      cy.off("tap", "node", onTap);
      cy.destroy();
    };
  }, []);

  return <div ref={container} style={{ height: 420, width: "100%" }} />;
}
```

`cytoscape({...})` 返回图实例，通常命名为 `cy`。每个元素都有一个 `data` 对象。边通过 `source` 和 `target` 引用节点 ID，而不是节点标签；节点和边的 ID 必须在整个图中唯一。这里的 `polarity` 是自定义数据，负向连线的虚线效果由样式规则显式设置。

## cytocausal 中的同一张图

把模型放在 `data.ts` 中。节点和边属于一个快照，数据集可以包含多个快照，用于版本比较。

```ts
// data.ts
import type { CausalDataset } from "@cytocausal/core";

export const dataset: CausalDataset = {
  id: "plant-water",
  snapshots: [{
    id: "initial",
    nodes: [
      { id: "rain", label: "Rain", metadata: { category: "weather" } },
      { id: "water", label: "Soil water" },
      { id: "stress", label: "Plant water stress" },
    ],
    edges: [
      { id: "rain-water", source: "rain", target: "water", polarity: "positive" },
      { id: "water-stress", source: "water", target: "stress", polarity: "negative" },
    ],
  }],
};
```

```tsx
"use client";

import type { LayoutOptions } from "cytoscape";
import type { CausalStyleOptions } from "@cytocausal/cytoscape";
import { CausalWorkspace } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { dataset } from "./data";

const layout: LayoutOptions = { name: "breadthfirst", directed: true, padding: 40 };
const styleOptions: CausalStyleOptions = {
  baseRules: [{
    selector: 'node[category = "weather"]',
    style: { "border-width": 2, "border-color": "#777" },
  }],
};

export function App() {
  return <CausalWorkspace dataset={dataset} title="Plant water" layout={layout} styleOptions={styleOptions} />;
}
```

`CausalWorkspace` 管理图的生命周期，并提供选择、搜索、分析面板和视图控件。因果样式自动提供极性标签和线型。`baseRules` 在交互状态规则之前加入天气节点的边框，因此内置高亮仍能优先生效。配置对象应放在组件外；依赖 props 时，可使用 memo 保持引用稳定。

## 数据如何对应

| 原生 Cytoscape.js | cytocausal 输入 |
| :--- | :--- |
| 节点 `data.id`、`data.label` | 节点 `id`、`label` |
| 边 `data.source`、`data.target` | 边 `source`、`target` |
| 自定义的边 `data.polarity` | 有类型约束的边 `polarity`：`positive` 或 `negative` |
| 节点 `data.category` | 节点 `metadata.category` |
| 元素 `position` | 节点 `position`，位于 `metadata` 外 |
| 一组 elements | `CausalDataset.snapshots` 中的一个快照 |

需要接入底层时，可以使用公开的 `toElements` 完成转换：

```ts
import { toElements } from "@cytocausal/cytoscape";
import { dataset } from "./data";

const elements = toElements(dataset.snapshots[0]);
```

它返回 `{ nodes, edges }`，可传给 Cytoscape 的 `elements` 选项。`metadata` 中的字段会复制到元素 `data`，所以两种示例都能使用 `node[category = "weather"]`。生成的 `id`、`label`、`support` 等字段会覆盖同名元数据，自定义字段应避免重名。出处等领域字段见[数据模型](/zh-cn/data-model/)。

## 如何阅读选择器和样式

| 表达式 | 含义 |
| :--- | :--- |
| `node` / `edge` | 所有节点 / 所有边 |
| `#rain` | ID 为 `rain` 的元素 |
| `node[category = "weather"]` | `data.category` 等于 `weather` 的节点 |
| `edge[polarity = "negative"]` | `data.polarity` 等于 `negative` 的边 |
| `node:selected` | 处于 Cytoscape 原生选中状态的节点 |
| `data(label)` | 将元素的 `label` 字段读取为样式值 |

一条规则由 `selector` 和 `style` 对象组成。它们看起来像 CSS，但作用于图元素，而不是 HTML。图中使用 `background-color`、`target-arrow-shape` 等 Cytoscape 样式属性，外围界面使用页面 CSS。原生 `:selected` 不一定对应 cytocausal 的全部选择和高亮状态，这些状态应通过库的交互 API 管理。

更完整的定制方式见[主题与样式](/zh-cn/theming/)，其中也介绍了如何用 `createCausalStyle(theme, { baseRules })` 为 `GraphView` 创建样式表。

## 布局、集合和事件

布局计算节点的位置，不改变模型中的关系。示例使用内置的 `breadthfirst` 布局，并设置 `directed: true`。初始化选项会启动布局；之后调用 `cy.layout(...)` 创建的布局，需要用 `.run()` 启动。

以下调用假设你已经持有一个有效的 `cy` 实例：

```ts
const rain = cy.getElementById("rain");
const negativeLinks = cy.edges('[polarity = "negative"]');
console.log(rain.data("label"), negativeLinks.length);
cy.fit(cy.elements(), 40);
cy.layout({ name: "breadthfirst", directed: true }).run();
```

查询返回元素集合，`getElementById` 也返回包含零个或一个元素的集合。`fit` 调整视口。对于任意输入的 ID，使用 `getElementById(id)` 可以避免拼接和转义 ID 选择器。

原生示例中的 `cy.on("tap", "node", handler)` 监听节点点击或触摸，`event.target` 是被点击的节点。不再需要监听时，使用同一个 handler 引用移除监听。

## 在 React 中从哪里扩展

| 需求 | 优先使用的入口 |
| :--- | :--- |
| 修改节点、边、元数据或版本 | 通过 React 更新 dataset |
| 修改外观或布局 | `styleOptions`、主题和布局 props |
| 选择节点、探索原因和结果 | [组件](/zh-cn/components/)和[交互](/zh-cn/interactions/) API |
| 添加专门的原生事件或集成 | 通过 `GraphView` 的 `onReady` 获取当前实例 |

直接调用 `cy.add()`、`cy.remove()` 或 `element.data()` 不会更新 `CausalDataset` 或 React 状态。之后的同步或重建可能覆盖这些修改，分析也仍使用 dataset。因此模型编辑应更新 dataset。实例由所属组件负责销毁；自定义集成负责清理自己的监听，并处理实例被替换的情况。详见 [React 生命周期](/zh-cn/react-lifecycle/)和[稳定布局](/zh-cn/stable-layouts/)。

完整的原生 API 请查阅官方的[元素](https://js.cytoscape.org/#notation/elements-json)、[选择器](https://js.cytoscape.org/#selectors)、[样式](https://js.cytoscape.org/#style)、[事件](https://js.cytoscape.org/#events)和[布局](https://js.cytoscape.org/#layouts)文档。当前工作区固定使用 Cytoscape.js 3.31.0，采用新版文档中的 API 前应检查兼容性。
