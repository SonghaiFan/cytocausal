---
title: "快速开始"
---

# 快速开始

先用数据集构建因果图界面，再添加应用需要的面板与交互。`CausalWorkspace` 提供完整浏览界面，`CausalProvider` 用于自行组合组件，`CausalEditor` 提供创作控件。

本指南使用源码工作区，需要 Node.js 22.18 或更高版本。

## 运行 starter

```sh
git clone https://github.com/SonghaiFan/cytocausal.git
cd cytocausal
npm install
npm run dev
```

打开 `http://localhost:3102` 查看包含两个版本的虚构咖啡店模型。打开 `http://localhost:3102/editor` 体验可编辑示例。

## 替换模型

编辑 `apps/starter/src/data.ts`。数据集包含快照，每个快照包含节点与边。边通过 ID 引用节点，并可标注正向或负向极性。

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

`CausalWorkspace` 会在侧栏显示数据验证问题。导入 CSV、电子表格或现有 JSON，请阅读[接入自己的数据](/zh-cn/import-data/)。

## 选择界面

编辑 `apps/starter/src/components/App.tsx` 修改浏览界面。

| 需求 | 起点 | 继续阅读 |
| --- | --- | --- |
| 图、搜索、详情与分析面板 | `CausalWorkspace` | [组合界面](/zh-cn/components/) |
| 自行排列图与面板 | `CausalProvider` 和 `CausalGraph` | [组合面板](/zh-cn/example-compose/) |
| 编辑节点与关系 | `CausalEditor` | [可编辑图](/zh-cn/components/#可编辑的因果图) |
| 专用渲染器集成 | `GraphView` | [React 生命周期](/zh-cn/react-lifecycle/) |

保留 starter 的浏览器端加载边界，为图容器设置高度。引入一次 `@cytocausal/react/styles.css`；编辑器还需要 `@cytocausal/react/editor.css`。

应用需要通过按钮编辑数据、撤销重做或共享选择时，阅读[文档命令](/zh-cn/commands/)。

## 按任务继续

- **构建界面：**[样式](/zh-cn/theming/)与[交互](/zh-cn/interactions/)。
- **描述和分析模型：**[数据模型](/zh-cn/data-model/)、[证据](/zh-cn/provenance/)与[因果分析](/zh-cn/causal-analysis/)。
- **比较版本：**[稳定布局](/zh-cn/stable-layouts/)与[版本过渡](/zh-cn/version-transitions/)。
- **从可运行代码开始：**[选择示例](/zh-cn/examples/)。

独立的 [Cytoscape.js 课程](/zh-cn/cytoscape-basics/)通过 React 和原生 JavaScript 独立示例页讲解底层 API。使用 Cytocausal 不需要先完成该课程；需要向框架添加原生行为时，阅读[通过 Cytoscape.js 扩展](/zh-cn/cytoscape-integration/)。

仓库设置与贡献流程见 [CONTRIBUTING.md](https://github.com/SonghaiFan/cytocausal/blob/main/CONTRIBUTING.md)。复用应用数据集前，请阅读 [DATA.md](https://github.com/SonghaiFan/cytocausal/blob/main/DATA.md)。
