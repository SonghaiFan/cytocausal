---
title: "案例：Perspectiva"
---

# 案例：Perspectiva

Perspectiva 用于比较参与式工作坊中不同版本的因果回路图。每位参与者先画出第一版图，研究人员再整理出术语统一的最终版。研究问题是两者之间发生了什么变化。

![Perspectiva 比较图的第一版和最终版](/images/perspectiva-compare.png)

| 项目 | 详情 |
| :--- | :--- |
| 数据 | 8 位参与者，每位都有 V1 和 final 快照 |
| 规模 | 每张图最多 32 个节点 |
| 连接 | 有向，带极性 |
| 证据 | 每位参与者的原始术语 |
| 对应关系 | 129 个 V1 节点连接到 final 节点 |

## 需求

- 并排显示两个版本，相同节点位于相同位置
- 在同一张图上切换版本
- 能看到每个术语的来源

## 对齐问题

原应用按 ID 匹配节点，假设节点在各版本之间保持同一 ID。事实并非如此：

- V1 的 ID 来自主 ID 列，而 final 的 ID 来自映射索引。
- 多个 V1 节点合并时，只保留了最后一行的索引。

126 对映射节点中只有 44 对 ID 相同，三个数据集完全没有相同 ID，所以视图看起来对齐，实际并没有。

重写 ID 行不通，因为合并节点会发生冲突。映射表本来就是权威来源，所以它成为了[对应关系](/zh-cn/data-model/)，数据本身无需改动。

## 框架如何解决

| 需求 | 机制 | 章节 |
| :--- | :--- | :--- |
| 跨版本匹配节点 | `Correspondence` | [数据模型](/zh-cn/data-model/) |
| 并排比较 | `CompareView` | [稳定布局](/zh-cn/stable-layouts/) |
| 在版本之间移动 | `animateSnapshots` | [版本过渡](/zh-cn/version-transitions/) |
| 悬停显示原始术语 | `Evidence`、`renderTooltip` | [React 生命周期](/zh-cn/react-lifecycle/) |

## 结果

使用 fcose 时，全部 8 个数据集的每个锚定节点偏移都为 0；`expert_9` 使用 cola 时也是如此。切换版本时保留同一张图，两种视图中的位置一致。Playwright 测试会对每个数据集检查这些内容，包括快速切换。

验证还发现了一张图中的重复连接。它没有造成影响，现在导入器会合并完全重复的连接。

## 运行

```sh
npm install
npm run dev:perspectiva
```

打开 `http://localhost:3100`。添加 `?dataset=expert_9` 选择数据集，添加 `?debug=1` 显示数据集选择器。
