---
title: "主题与样式"
---

# 主题与样式

主题决定图和周围页面的颜色、字体和动效。颜色按含义命名，比如 `ink` 和 `accent`，改一处，所有地方都会更新。

## 视觉含义

默认样式用箭头表示方向，用线型和符号表示极性，用颜色表示选择和版本变化。线宽可以表示提出者支持度，节点大小可以表示分数。添加自定义规则时，应保留这些含义，让选择状态与数据值保持可区分。

节点轮廓可用于应用自己的分类，键盘光标使用独立光晕。选择样式优先于版本变化样式，让选中的路径或回路保持可见。

## 修改颜色

从 `lightTheme` 或 `darkTheme` 开始，只改你需要的部分：

```ts
import { createCausalStyle, lightTheme, type CausalTheme } from "@cytocausal/cytoscape";

export const theme: CausalTheme = {
  ...lightTheme,
  name: "my-theme",
  colors: { ...lightTheme.colors, accent: "#12b886" },
};

export const stylesheet = createCausalStyle(theme, {
  node: "pill",
  link: "flowing",
});
```

把 `stylesheet` 传给 `GraphView`。修改它时图会就地更新样式，节点不会移动。使用 `CausalWorkspace` 时，用 `themes` 传入主题，用 `styleOptions` 传入这些选项。

## 选择形状

| 选项 | 取值 | 用途 |
| :--- | :--- | :--- |
| `node` | `pill`（默认）、`dot` | `pill` 把标签放在节点内，`dot` 适合大型图 |
| `link` | `flowing`（默认）、`bezier`、`straight` | `straight` 适合密集的图 |
| `sizeByScore` | `true` | 根据 `score` 数据（0 到 1）决定节点大小 |
| `managedLabels` | `true` | 由你的代码放置标签 |
| `baseRules` | Cytoscape 规则 | 你的应用特有的样式 |

## 配合 ROC UI

组件的间距、圆角和控件尺寸与 [ROC UI](https://github.com/SonghaiFan/roc-ui) 一致。如果页面设置了 `--roc-radius-control`、`--roc-control-height` 等 `--roc-*` 变量，组件会跟随它们。颜色仍然来自主题。

## 添加自己的规则

用 `baseRules` 为你的数据设置样式。这些规则排在交互状态之前，所以高亮仍会显示在最上层：

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";
import type { Stylesheet } from "cytoscape";

const statusRules = [
  { selector: 'node[status = "new"]', style: { "border-width": 2, "border-color": lightTheme.colors.ink } },
] as unknown as Stylesheet[];

export const stylesheet = createCausalStyle(lightTheme, { baseRules: statusRules });
```

## 支持深色模式

`useColorScheme` 会跟随系统设置，直到读者自行选择。`CausalRoot` 把主题应用到其中的所有内容：

```tsx
"use client";
import { CausalRoot, themeForScheme, useColorScheme } from "@cytocausal/react";
import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  const { scheme, setScheme } = useColorScheme();
  return (
    <CausalRoot theme={themeForScheme(scheme)}>
      <button onClick={() => setScheme(scheme === "dark" ? "light" : "dark")}>Switch theme</button>
      {children}
    </CausalRoot>
  );
}
```

## 页面样式

`CausalRoot` 会把每种颜色都暴露为 CSS 变量，比如 `--cc-border` 和 `--cc-muted-text`，你的 CSS 也可以使用同一套主题。

## 缩放时会发生什么

`createCausalStyle` 的 `zoom` 选项（或 `CausalProvider` 的 `styleOptions` 中的 `zoom`）为所有标记统一设定一条规则，包括圆点、文字、线、箭头和边框。

| 模式 | 放大 4 倍时，标记会 | 适合 |
| :--- | :--- | :--- |
| `magnify` | 变大 4 倍，像放大照片 | 整体浏览、标签在节点内部的小型图，比如 Perspectiva |
| `balanced` | 按缩放的平方根变大 2 倍，与 Sigma.js 相同 | 两者之间 |
| `spread` | 屏幕尺寸不变，只有节点之间的距离被拉开 | 需要放大来分开拥挤节点的密集网络，比如 Causal Explorer |

```ts
import { createCausalStyle, lightTheme } from "@cytocausal/cytoscape";

export const stylesheet = createCausalStyle(lightTheme, { node: "dot", link: "straight", zoom: "spread" });
```

使用 `managedLabels` 时默认为 `spread`，否则为 `magnify`。在任何模式下，托管标签的文字都保持固定大小，以便阅读。

Cytoscape 的所有尺寸都以模型单位计算，所以 `spread` 和 `balanced` 需要在每次缩放时写入对应的尺寸。`keepConstantSize(cy)` 会在每一步缩放时完成这件事，标记不会先变大再弹回原样。`keepLabelsReadable` 以及 `useCausalGraph` 的 `readableLabels` 会自动开启它。Causal Explorer 提供了一个切换按钮，可以对比这三种模式。

节点、连线和标签应使用一致的缩放模式，以保持相对视觉比例。

## 线条、箭头和文字的尺寸

Cytoscape 使用模型单位计算尺寸：缩放为 1 时宽 2 px 的线，在缩放为 3 时显示为 6 px。需要保持屏幕尺寸时使用 `spread`，需要在缩放时缓慢增大标记时使用 `balanced`。

箭头大小也受 `arrow-scale` 影响，仅减小线宽不一定能缩小箭头。自定义箭头尺寸时可使用 `arrowLength(width, scale)`。有向因果图可选择 `flowing`、`bezier` 或 `straight` 连线。

密集图需要可读标签时，在 `useCausalGraph` 中启用 `readableLabels`。详见[规模与性能](/zh-cn/scale-performance/)。

## 动效

为自定义背景色选择黑色或白色文字时，可使用 `textOn(color)`。

`theme.motion` 以毫秒为单位设置时长：

| 时长 | 用途 |
| :--- | :--- |
| `fade` | 元素出现和消失 |
| `move` | 节点在版本之间移动 |
| `focus` | 把视图移动到节点 |
| `view` | 缩放和适配视图 |
| `highlight` | 悬停和选中时，高亮的淡入淡出 |

把它作为 `motion` 传给 `GraphView`。如果读者的系统要求减少动态效果，cytocausal 会自动跳过这些动画。

## 无障碍

`lightTheme` 和 `darkTheme` 都经过对比度测试：文字达到 4.5:1，图形颜色相对背景达到 3:1。自定义主题不会被检查，请自行测试。
