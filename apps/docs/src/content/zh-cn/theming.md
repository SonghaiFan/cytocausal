---
title: "主题与样式"
---

# 主题与样式

主题决定图和周围页面的颜色、字体和动效。颜色按含义命名，比如 `cause` 和 `reinforcing`，改一处，所有地方都会更新。

## 修改颜色

从 `lightTheme` 或 `darkTheme` 开始，只改你需要的部分：

```ts
import { createCausalStyle, lightTheme, type CausalTheme } from "@cytocausal/cytoscape";

export const theme: CausalTheme = {
  ...lightTheme,
  name: "my-theme",
  colors: { ...lightTheme.colors, node: "#0f766e", cause: "#b45309" },
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
  { selector: 'node[status = "new"]', style: { "background-color": lightTheme.colors.added } },
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

不要混用规则。Explorer 早先的版本让线和文字保持固定，圆点却会放大，结果放大后就成了大圆点之间连着发丝般细的线。

## 线条、箭头和文字的尺寸

这些默认值来自阅读 Cytoscape 3.31 的渲染代码，而不是凭感觉设定的。其中有几条规则文档里没有写，但它们决定了图看起来对不对。

**尺寸以模型单位计算。** Cytoscape 文档说尺寸是"缩放为 1 时的值"。2 px 的线在缩放为 3 时会变成 6 px。小型图通常整体浏览，这样没有问题。但在需要放大查看的密集图上，线条、边框和文字都会跟着变粗变大，所以 `spread` 会让它们在屏幕上保持固定尺寸。

**箭头有最小尺寸。** 渲染器画的是一个长宽均为 `0.3 × size` 的三角形，其中：

```
size = max((width × 13.37) ^ 0.9, 29) × arrow-scale
```

线宽小于约 3 时，箭头与线宽无关，只由 `arrow-scale` 决定。所以把线变细并不会让箭头变小。Cytoscape 自己的默认值（3 px 的线、scale 为 1）画出的箭头约 8.7 px，大约是线宽的三倍。`arrowLength(width, scale)` 可以帮你算出这个值。

**`<pos>-arrow-width` 不是箭头的大小。** 它是空心箭头的描边宽度。

**透明会多花一倍的代价。** 连线的 `opacity` 小于 1 时，渲染器会先擦掉每个箭头下方的区域再绘制，而且重叠的连线在交叉处会叠加变深。所以退到背景的连线改用一种浅色的不透明颜色，由 `mix(color, background, amount)` 计算。只有高亮时的调暗才使用 `opacity`。

**点击范围是固定的。** 在任何缩放下，指针离连线 8 个屏幕像素以内（触屏为 24）都算点中。所以细线和粗线一样容易点到。

**箭头需要 `straight` 或 `bezier`。** `haystack` 是 Cytoscape 最快的连线样式，但它画不了目标箭头，而因果连线需要箭头。

| | 线 | 箭头 | 选中节点的边框 |
| :--- | :--- | :--- | :--- |
| 小型图（`flowing`） | 2 px | 7 px | 2 px |
| 密集图（`straight`） | 1 px，浅色 | 6 px | 3 px |
| 高亮时 | 2 px，路线为 3 px | 与未高亮时相同 | 相同 |
| `weightBySupport` | 1.5 到 7 px | 线宽超过 3 px 后随之变大 | 相同 |

这些是缩放为 1 时的尺寸。使用 `spread` 时，它们在任何缩放下都不变；使用 `balanced` 时，它们按缩放的平方根变大。

绘制尺寸小于 `min-zoomed-font-size` 的标签会被跳过，因为它们看不清，却仍要花时间绘制：点旁边的标签阈值为 6 px，胶囊内较小的文字为 3 px。

## 动效

默认配色是蓝、黄、黑。节点为黄色，标签在黑白之间切换，以保证在每种颜色上都清晰。自定义规则可以用 `textOn(color)` 来选择文字颜色。

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
