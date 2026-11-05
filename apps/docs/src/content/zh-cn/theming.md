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

把 `stylesheet` 传给 `GraphView`。修改它时图会就地更新样式，节点不会移动。

## 选择形状

| 选项 | 取值 | 用途 |
| :--- | :--- | :--- |
| `node` | `dot`、`pill` | `pill` 把标签放在节点内 |
| `link` | `bezier`、`flowing`、`straight` | `straight` 适合密集的图 |
| `sizeByScore` | `true` | 根据 `score` 数据（0 到 1）决定节点大小 |
| `managedLabels` | `true` | 由你的代码放置标签 |
| `baseRules` | Cytoscape 规则 | 你的应用特有的样式 |

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

## 动效

`theme.motion` 以毫秒为单位设置时长：

| 时长 | 用途 |
| :--- | :--- |
| `fade` | 元素出现和消失 |
| `move` | 节点在版本之间移动 |
| `focus` | 把视图移动到节点 |

把它作为 `motion` 传给 `GraphView`。如果读者的系统要求减少动态效果，cytocausal 会自动跳过这些动画。

## 无障碍

`lightTheme` 和 `darkTheme` 都经过对比度测试：文字达到 4.5:1，图形颜色相对背景达到 3:1。自定义主题不会被检查，请自行测试。
