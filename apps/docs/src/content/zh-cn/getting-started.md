---
title: "快速开始"
---

# 快速开始

需要 Node.js 22.18 或更高版本。

```sh
git clone https://github.com/SonghaiFan/cytocausal.git
cd cytocausal
npm install
npm run dev
```

打开 `http://localhost:3102`，可以看到一个虚构的咖啡店小模型，它有两个版本，并列出了反馈回路。

## 改成你自己的应用

需要修改的内容都在 `apps/starter/src` 中：

| 文件 | 作用 |
| :--- | :--- |
| `data.ts` | 你的图，从替换这个文件开始 |
| `graph-style.ts` | 颜色、节点形状和连接形状 |
| `components/App.tsx` | 页面：图、搜索、版本按钮和回路列表 |

如果想保留 starter 作为参考，请把 `apps/starter` 复制为 `apps/your-app`，并修改其 `package.json` 中的 `name`。

## 添加数据

要修改颜色或形状，请参阅[主题与样式](/zh-cn/theming/)。

数据需要符合[数据模型](/zh-cn/data-model/)。只有 ID 和标签是必需的，所以一张图可以很简单：

```ts
import type { CausalDataset } from "@cytocausal/core";

export const dataset: CausalDataset = {
  id: "my-graph",
  snapshots: [
    {
      id: "final",
      nodes: [
        { id: "rain", label: "Rain" },
        { id: "floods", label: "Floods" },
      ],
      edges: [{ id: "rain-floods", source: "rain", target: "floods", polarity: "positive" }],
    },
  ],
};
```

`validateDataset` 发现的问题会显示在 starter 侧边栏顶部。

## 仓库结构

| 路径 | 内容 |
| :--- | :--- |
| `apps/starter` | 用于开发的起点应用 |
| `apps/perspectiva` | 示例：并排比较版本 |
| `apps/explorer` | 示例：探索大型网络 |
| `apps/docs` | 本站 |
| `packages/core` | 数据模型、验证和分析 |
| `packages/cytoscape` | 主题、样式、布局、过渡和高亮 |
| `packages/react` | `GraphView`、`CompareView`、`NodeSearch` 和 `useCausalGraph` |

运行示例：`npm run dev:perspectiva` 和 `npm run dev:explorer`。

## 参与贡献

请参阅 [CONTRIBUTING.md](https://github.com/SonghaiFan/cytocausal/blob/main/CONTRIBUTING.md)。仓库中的数据集有单独的条款，复用前请先阅读 [DATA.md](https://github.com/SonghaiFan/cytocausal/blob/main/DATA.md)。
