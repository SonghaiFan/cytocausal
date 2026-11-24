---
title: "示例"
---

# 示例

按当前任务选择 Cytocausal 示例，或进入独立的 Cytoscape.js 学习示例。

## 使用 Cytocausal 构建应用

这些示例使用同一份虚构花园数据，展示框架组件和数据分析。每页包含可操作示例及其源码。

| 任务 | 示例 | 相关指南 |
| --- | --- | --- |
| 用数据启动完整界面 | [完整工作区](/zh-cn/example-workspace/) | [快速开始](/zh-cn/getting-started/) |
| 自行排列图与侧栏 | [组合面板](/zh-cn/example-compose/) | [组合界面](/zh-cn/components/) |
| 比较节点改名后的快照 | [比较版本](/zh-cn/example-versions/) | [稳定布局](/zh-cn/stable-layouts/) |
| 不创建渲染器，直接查询路径与回路 | [无渲染器分析](/zh-cn/example-analysis/) | [因果分析](/zh-cn/causal-analysis/) |

在源码工作区运行 `npm run dev:docs`，或将示例及 `data.ts`、`garden.json` 复制到 starter。示例的组件实现位于 `apps/docs/src/components/examples/`，使用工作区中已有的依赖。

## 学习原生 Cytoscape.js

每个原生示例都有独立页面与章节导航。预览中可直接操作图；切换到源码时按需读取实际源文件，可选择文件、复制或直接打开。切换预览与源码会保留图状态。

| 主题 | 教程 | 独立示例 |
| --- | --- | --- |
| 环境搭建与初始化 | [阅读教程](/zh-cn/cytoscape-basics/setup/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/setup/) · [React](/examples/zh-cn/react/setup/) |
| 节点与边 | [阅读教程](/zh-cn/cytoscape-basics/elements/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/elements/) · [React](/examples/zh-cn/react/elements/) |
| 布局与视图 | [阅读教程](/zh-cn/cytoscape-basics/layouts/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/layouts/) · [React](/examples/zh-cn/react/layouts/) |
| 样式与动画 | [阅读教程](/zh-cn/cytoscape-basics/styles/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/styles/) · [React](/examples/zh-cn/react/styles/) |
| 交互与事件 | [阅读教程](/zh-cn/cytoscape-basics/events/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/events/) · [React](/examples/zh-cn/react/events/) |
| 图算法与分析 | [阅读教程](/zh-cn/cytoscape-basics/algorithms/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/algorithms/) · [React](/examples/zh-cn/react/algorithms/) |
| 数据导入导出 | [阅读教程](/zh-cn/cytoscape-basics/data/) | [Vanilla JavaScript](/examples/zh-cn/vanilla/data/) · [React](/examples/zh-cn/react/data/) |

原生示例用于学习底层 API。将这些操作接入因果图组件时，请阅读[通过 Cytoscape.js 扩展](/zh-cn/cytoscape-integration/)。
