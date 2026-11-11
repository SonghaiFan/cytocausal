---
title: "React 生命周期"
---

# React 生命周期

`GraphView` 根据 React props 管理 Cytoscape 实例，包括创建、更新和清理。需要在 `CausalWorkspace` 之外组合界面时，可使用该组件。

## 只在浏览器中渲染

Cytoscape 需要 DOM，所以不能在服务端渲染时运行。在 Next.js 中，用 `next/dynamic` 加载使用它的部分：

```tsx
"use client";
import dynamic from "next/dynamic";

export const AppLoader = dynamic(() => import("./App").then((module) => module.App), {
  ssr: false,
  loading: () => <p>Loading…</p>,
});
```

选项必须直接写在调用处。如果传入变量，Next.js 会报错 "next/dynamic options must be an object literal"。

## 使用 GraphView

```tsx
"use client";
import type { CausalDataset } from "@cytocausal/core";
import { fcoseLayout, type Positions } from "@cytocausal/cytoscape";
import { GraphView } from "@cytocausal/react";
import type { Stylesheet } from "cytoscape";
import { useRef } from "react";

const stylesheet: Stylesheet[] = [{ selector: "node", style: { label: "data(label)" } }];

export function Diagram({ dataset }: { dataset: CausalDataset }) {
  const positionCache = useRef<Record<string, Positions>>({});
  return (
    <GraphView
      dataset={dataset}
      snapshotId="V1"
      layout={fcoseLayout}
      stylesheet={stylesheet}
      positionCache={positionCache}
    />
  );
}
```

把 `layout` 和 `stylesheet` 定义在组件外或使用 memo，保持引用稳定。样式表变化会更新现有实例的样式；布局变化在启用 `animateLayouts` 时播放过渡，否则重建实例。

## 重建还是更新

| 变化 | 结果 |
| :--- | :--- |
| 数据集 | 销毁实例并新建 |
| 样式表 | 更新现有实例的样式 |
| 布局 | 启用 `animateLayouts` 时播放过渡，否则重建 |
| 快照，启用 `animateSnapshots` | 保留实例并播放动画 |
| 快照，未启用 `animateSnapshots` | 销毁实例并新建 |

需要在版本间保留节点连续性时，启用 `animateSnapshots`。详见[版本过渡](/zh-cn/version-transitions/)。

## 监听器比渲染活得更久

Cytoscape 监听器只绑定一次，但 React 的 props 会变化。闭包捕获 prop 的监听器，看到的始终是绑定时的旧值。通过 ref 读取可以避免这个问题：

```tsx
import type { Core, EventObject } from "cytoscape";
import { useEffect, useRef } from "react";

export function useNodeClicks(cy: Core | null, onClick: (id: string) => void) {
  const latest = useRef(onClick);
  useEffect(() => {
    latest.current = onClick;
  });

  useEffect(() => {
    if (!cy) return;
    const handler = (event: EventObject) => latest.current(event.target.id());
    cy.on("tap", "node", handler);
    return () => { cy.off("tap", "node", handler); };
  }, [cy]);
}
```

实例变化或组件卸载时，effect 会移除对应监听器。

## 用 onReady 添加自定义行为

常用的选中和视图控制可以直接使用 [`useCausalGraph`](/zh-cn/interactions/)。其他情况下，`GraphView` 会把每个新的 Cytoscape 实例传给 `onReady`。在这里绑定监听器，并把实例存入 ref，以便之后执行缩放到节点等操作。每次重建都会产生新实例，所以不要假设只有一个。

## 隐藏的页面会暂停动画

浏览器可能暂停隐藏标签页的动画帧，动画完成时间会延后到页面可见时。与动画无关的应用操作应避免依赖动画完成回调。