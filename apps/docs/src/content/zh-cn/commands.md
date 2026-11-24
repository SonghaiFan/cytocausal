---
title: "编辑数据与共享选择"
---

# 编辑数据与共享选择

用 `useCausalDocument` 保存一份数据与撤销历史，再把文档交给 `CausalProvider` 或 `CausalWorkspace`。图、按钮与编辑器通过同一个文档修改数据。

```tsx
"use client";
import { CausalGraph, CausalProvider, useCausal, useCausalDocument } from "@cytocausal/react";
import "@cytocausal/react/styles.css";
import { dataset } from "./data";

export function App() {
  const document = useCausalDocument({ initialDataset: dataset });
  return <CausalProvider document={document}>
    <Toolbar />
    <div style={{ height: 460 }}><CausalGraph /></div>
  </CausalProvider>;
}

function Toolbar() {
  const { edit, selection } = useCausal();
  if (!edit) return null;
  return <>
    <button onClick={() => edit.addNode({ label: "Sunlight" })}>Add node</button>
    <button onClick={() => edit.remove(selection.current())}>Delete selected</button>
    <button onClick={() => edit.undo()}>Undo</button>
  </>;
}
```

这是简短的接入结构；实际界面应检查命令返回的 `ok`，并显示 `error.message`。`initialDataset` 只在创建文档时读取。持久化可通过 hook 的 `onChange` 回调连接到应用自己的保存逻辑；框架不会自动保存。

## 原子编辑与撤销

```ts
const result = edit.batch("Add sunlight", draft => {
  const sun = draft.addNode({ label: "Sunlight" });
  draft.addEdge({ source: sun.id, target: "water", polarity: "negative" });
});
if (!result.ok) showError(result.error.message);
```

Provider 中的 `edit` 绑定当前快照。一个 batch 只提交一次、通知一次、产生一个撤销项。回调必须同步；校验失败、嵌套命令或回调抛错会回滚整个 batch。删除节点同时删除关联边与该版本的对应关系，其他快照不受影响。

命令返回 `{ ok: true, value: { changed, revision, value } }` 或 `{ ok: false, error }`。无变化操作不增加修订号，也不会清空 redo。通过 `useCausalDocumentState(document)` 读取 `canUndo`、`canRedo` 与 `revision`。

## 查询与选择

```ts
selection.set(query.nodes({ metadata: { category: "weather" } }));
selection.all({ kind: "nodes", scope: "visible" });
selection.invert();
selection.clear();
```

`query.node/edge` 读取脱离文档的对象，`query.nodes/edges` 返回节点与边的 ID 集合。支持属性筛选、predicate、union、intersection、difference 和 filter；集合组合返回 Result，需要先检查 `ok`。当前查询针对整个快照。集合带有 `snapshotId` 与 `revision`；版本或修订不匹配时，编辑与选择命令会拒绝使用旧集合。

选择接口与框架交互共用状态，支持节点与边混选。`maxSelected` 限制节点数量，超限时返回错误。`all` 和 `invert` 默认作用于完整快照，`scope: "visible"` 明确限定为可见元素，并要求图已挂载。

## 镜头与 JSON

```ts
view.fit({ padding: 40 });
view.zoom({ factor: 1.2 });
view.pan({ by: { x: 40, y: 0 } });
view.controls({ dragging: false });

const parsed = io.parse({ format: "dataset-json", text });
if (parsed.ok) edit.replaceDataset(parsed.value.dataset);
const output = io.export({ format: "dataset-json" });
```

镜头操作与输入开关只影响当前视图；保存布局位置需要显式调用 `view.positions()`，检查成功后传给 `edit.setPositions(...)`。图未准备好时，镜头操作返回 `ViewUnavailable`。输入开关会在同一视图的渲染器替换后重新应用。

JSON 解析不修改文档；确认成功后再应用。导出返回 JSON 文本，不自动下载。`document.replaceDataset(...)` 可撤销；`document.load(...)` 表示打开新内容并清空历史，不触发 hook 的保存回调。CSV、图片输出、异步布局和高级样式便利接口尚未包含在这一组命令中。

## 兼容现有用法

原有 `dataset={dataset}` 保持有效；在这种模式中 `edit` 为 null，数据由应用自己的 React 状态管理。`document` 与 `dataset` 不能同时传入。一个文档可以交给多个 Provider；它们共享数据与历史，但保持各自的版本、选择和镜头。

`CausalEditor` 同样接受 `document`，旧的 `initialDataset` 写法保持有效。编辑器 ref 和 header/toolbar 回调中的 `api.edit`、`api.selection` 暴露同一组接口；旧的替换、命名、撤销和重做方法继续有效。

## 独立示例与源码

- [元素编辑与历史](/examples/zh-cn/cytocausal/elements/)
- [选择与镜头控制](/examples/zh-cn/cytocausal/events/)
- [JSON 导入导出](/examples/zh-cn/cytocausal/data/)
