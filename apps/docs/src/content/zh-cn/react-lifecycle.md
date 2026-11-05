---
title: "React 生命周期"
---

# React 生命周期

Cytoscape 和 React 都想掌控屏幕上的内容。cytocausal 让两者分工：React 决定显示什么，一个长期存在的 Cytoscape 实例负责绘制。`@cytocausal/react` 中的 `GraphView` 已经处理好这些，本章解释它为什么这样工作。

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

请把 `layout` 和 `stylesheet` 定义在组件外部以保持稳定。两者任一变化都会让 `GraphView` 重建图，如果每次渲染都生成新对象，图就会反复重建。

## 重建还是更新

| 变化 | 结果 |
| :--- | :--- |
| 数据集或布局 | 销毁实例并新建 |
| 快照，启用 `animateSnapshots` | 保留实例并播放动画 |
| 快照，未启用 `animateSnapshots` | 销毁实例并新建 |

重建会丢失所有节点的身份，因此无法平滑移动。Perspectiva 最初每次切换版本都会重建，看起来就像一张全新的图。详见[版本过渡](/zh-cn/version-transitions/)。

## 监听器比渲染活得更久

Cytoscape 监听器只绑定一次，但 React 的 props 会变化。闭包捕获 prop 的监听器，看到的始终是绑定时的旧值。通过 ref 读取可以避免这个问题：

```tsx
import type { Core } from "cytoscape";
import { useEffect, useRef } from "react";

export function useNodeClicks(cy: Core | null, onClick: (id: string) => void) {
  const latest = useRef(onClick);
  useEffect(() => {
    latest.current = onClick;
  });

  useEffect(() => {
    cy?.on("tap", "node", (event) => latest.current(event.target.id()));
  }, [cy]);
}
```

这在 Perspectiva 中造成过真实的 bug：一个 `layoutstop` 监听器保留了旧版本的缓存键，把 final 的位置存到了 V1 的键下，污染了位置缓存。

## 用 onReady 添加自定义行为

`GraphView` 会把每个新的 Cytoscape 实例传给 `onReady`。在这里绑定监听器，并把实例存入 ref，以便之后执行缩放到节点等操作。每次重建都会产生新实例，所以不要假设只有一个。

## 隐藏的页面会暂停动画

浏览器会在隐藏页面中暂停 `requestAnimationFrame`。Cytoscape 动画因此无法结束，动画布局的 `layoutstop` 不会触发，画布也保持空白。在后台标签页或隐藏面板中测试时，这看起来很像代码有 bug。请在可见页面或无头浏览器中测试。
