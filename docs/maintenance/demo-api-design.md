# Cytoscape demo 功能在 Cytocausal 中的接口设计

状态：第一阶段已在本地源码实现，其余为设计草案。基于 2026-11-23 的工作区，尚未提交或发布。

当前可用：`createCausalDocument`、`useCausalDocument`、文档 CRUD/batch/history、共享 selection、快照集合 query、基础 view 和 dataset-json I/O，以及 Editor 文档接入。准确用法见[命令指南](../../apps/docs/src/content/zh-cn/commands.md)。下文布局任务、appearance、通用事件、算法与其他格式仍为后续提案，不能当成已导出的接口。

实现细化：Core 文档工厂支持无 UI 测试和 React/Editor 两种宿主；查询集合组合返回 Result。只读 dataset 模式保持有效。三个独立 Cytocausal 示例覆盖 elements/events/data，未嵌入整套 Workspace。

目标：七章教程中讲解和展示的功能，都能在 Cytocausal 中找到清楚的使用入口。常用操作负责数据、视图、撤销和生命周期的一致性；罕见的样式属性或扩展算法仍允许通过明确的原生扩展入口使用。

## 1. 现有能力与主要缺口

核对范围同时包括教程正文、React demo 和 vanilla demo，不能只统计按钮。例如，正文还有集合运算、全路径、K-means、复合节点、动画队列和手势识别。

| 现有模块 | 当前能做什么 | 需要收拢的复杂度 |
| --- | --- | --- |
| `@cytocausal/core` | 数据类型、校验、版本、因果路径/回路、中心性、领域导入器 | 通用编辑命令、集合查询、其他图算法、通用文件格式 |
| `CausalProvider` / `useCausal` | 数据集、版本、主题、布局选择、过滤、交互状态、图片下载 | 数据写入与编辑器尚未共享统一的公开命令接口 |
| `useCausalGraph` | 选择、焦点、路径高亮、缩放、fit、键盘与环形菜单 | 批量选择、选择集合、视图控制和事件的稳定入口 |
| `CausalEditor` | 内部节点/边编辑、撤销重做；ref 暴露整体替换和命名 | 应用工具栏无法直接调用内部的添加、更新、删除等命令 |
| `@cytocausal/cytoscape` | 样式、布局、位置缓存、动画、视图同步 | 原生 `Core` 的准备、替换、取消、清理仍由高级调用方处理 |

已核对的来源：

- [Provider](../../packages/react/src/CausalProvider.tsx)、[交互 hook](../../packages/react/src/useCausalGraph.ts)、[编辑器](../../packages/react/src/CausalEditor.tsx)、[历史状态](../../packages/react/src/editor-history.ts)。
- [数据编辑](../../packages/core/src/editing.ts)、[图算法](../../packages/core/src/graph.ts)、[因果路径](../../packages/core/src/paths.ts)。
- [布局](../../packages/cytoscape/src/layouts.ts)、[视图](../../packages/cytoscape/src/view.ts)、[样式](../../packages/cytoscape/src/style.ts)、[位置](../../packages/cytoscape/src/positions.ts)。
- [教程](../../apps/docs/src/content/en/cytoscape-basics/)、[React 示例](../../apps/docs/src/components/tutorials/react/)、[vanilla 示例](../../apps/docs/public/tutorials/vanilla/en/)。

## 2. 推荐的模块组织

保留 `useCausal()` 作为界面中的入口，提供六个职责明确的接口：

```tsx
const { edit, selection, view, appearance, query, io } = useCausal();
```

- `edit`：修改当前快照或整个数据集，校验并写入撤销历史。
- `selection`：读写框架选择状态，与图、搜索、侧栏和键盘交互一致。
- `view`：布局、镜头和输入开关，不暗中修改因果数据。
- `appearance`：声明式样式及临时效果，保留框架的交互状态规则。
- `query`：从明确范围中获取节点、边、遍历结果或算法结果。
- `io`：解析、序列化与图片输出，返回数据或文件，由宿主决定保存。

这是一个拥有内部状态与适配器的深模块，而不是给每个 `cy.*` 方法改名。接口隐藏重复出现的校验、事务、选择同步、实例重建、可取消任务和资源清理。

### 一个可编辑文档，多种界面

建议新增 `useCausalDocument`，作为 React 中的文档状态宿主：

```tsx
function App() {
  const document = useCausalDocument({
    initialDataset: dataset,
    onChange: saveDraft, // 宿主决定是否持久化
  });

  return (
    <CausalProvider document={document}>
      <CausalGraph />
      <Toolbar />
      <SelectionPanel />
    </CausalProvider>
  );
}

function Toolbar() {
  const { edit, selection } = useCausal();
  if (!edit) return null;

  return <>
    <button onClick={() => edit.addNode({ label: "Sunlight" })}>添加节点</button>
    <button onClick={() => edit.remove(selection.current())}>删除选中项</button>
  </>;
}
```

所有代码均为**拟议用法**。`saveDraft` 是应用自己的持久化回调；框架不自动写文件、localStorage 或远端。

### 状态的唯一归属

| 状态 | 唯一拥有者 | 约束 |
| --- | --- | --- |
| 数据集、文档 revision、undo/redo | Document 模块 | Provider、Editor 都使用同一文档；不各自维护一份 dataset |
| 当前版本、选择、过滤、镜头、临时样式 | 每个 Provider 的视图会话 | 同一文档可以同时显示不同版本；选择和镜头不全局共享 |
| Cytoscape 实例与任务句柄 | Renderer 适配器 | 可替换、可销毁；不进入持久化数据与公开查询结果 |
| 布局得到的位置 | 当前视图的位置缓存 | 调用 `edit.setPositions(...)` 才写入节点 `position` |

`CausalProvider` 的 `document` 与旧 `dataset` 输入互斥。旧 `dataset` 写法继续有效，并保持只读文档模式：`edit === null`；选择、视图和查询仍可用。不得悄悄产生无法传回宿主的内部可编辑副本。

`initialDataset` 只在创建文档时读取。可撤销地替换内容使用 `document.replaceDataset`；打开另一文档并重置历史使用 `document.load`。不同时引入另一套受控 `dataset/onDatasetChange` 协议。

内部 document 必须能被现有编辑器宿主复用；无需预先公开一个与 React 无关的 store 工厂。Core 的纯编辑/查询函数仍可在 Node 和 Worker 中独立使用。

## 3. 编辑命令：一次操作完成校验、历史与同步

```ts
// 拟议签名；NodeInput 基于当前 CausalNode，允许省略 id；其他类型同理。
interface CausalEditing {
  addNode(input: NodeInput): EditResult<{ id: string }>;
  addEdge(input: EdgeInput): EditResult<{ id: string }>;
  updateNode(id: string, patch: NodePatch): EditResult;
  updateEdge(id: string, patch: EdgePatch): EditResult;
  remove(target: ElementTarget): EditResult;
  setPositions(positions: Record<string, { x: number; y: number }>): EditResult;
  batch(label: string, run: (draft: EditDraft) => void): EditResult;
  replaceDataset(dataset: CausalDataset): EditResult;
  undo(): EditResult;
  redo(): EditResult;
}

type ElementIds = { nodes?: readonly string[]; edges?: readonly string[] };
interface ElementSet extends ElementIds { snapshotId: string; revision: number }
type ElementTarget = ElementIds | ElementSet;
type Result<T> = { ok: true; value: T } | { ok: false; error: CausalError };
type EditResult<T = undefined> = Result<{
  changed: boolean;
  revision: number;
  value: T;
}>;
```

- Provider 中的 `edit` 绑定其**当前快照**。文档级操作必须显式携带 `snapshotId`，避免把另一比较视图的版本当成当前版本。
- 节点/边 ID 共享快照命名空间。省略 ID 时由可注入的 ID 工厂生成；结果返回实际 ID。更新不能改变 ID；改边端点通过 `updateEdge` 的显式 `source` / `target` 字段完成。
- 标签、极性、证据、metadata 的读写遵循当前领域类型。禁止把 `data.id`、`data.source` 等原生渲染字段当成可任意覆盖的 metadata。
- 删除节点同时删除关联边，并清理涉及该版本的对应关系；其他快照中的节点不随之删除。
- 无效端点、重复 ID、无效极性、未知 ID 返回结构化错误。普通用户输入错误不靠异常和 `alert`；不静默跳过部分命令。
- 一次 `batch` 使用隔离 draft，最终统一校验、提交、发出一次文档变更并形成一个 undo 项。中途失败全部回滚。回调只允许同步执行；返回 Promise 视为错误，绝不提交部分结果。
- 无变化命令返回 `changed: false`，不递增 revision，不清空 redo。
- 外部数据替换必须区分“可撤销替换”与“打开新文档并清空历史”。后者是 document 的显式 `load(dataset, { resetHistory: true })`，不复用用户编辑命令。
- undo/redo 恢复文档；每个视图再修剪无效选择。编辑器可保存发起视图的会话 checkpoint，恢复其选中项；不得切换其他比较视图的版本或选择。

```ts
const result = edit.batch("添加日照关系", draft => {
  const sun = draft.addNode({ label: "Sunlight" });
  draft.addEdge({ source: sun.id, target: "water", polarity: "negative" });
});
if (!result.ok) showError(result.error.message);
```

`EditDraft` 的创建命令先分配并返回 ID，操作只记录在隔离 draft 中；统一校验在提交前执行。校验失败或回调抛错使整个事务失败，不要求调用者在事务中手工回滚。事务回调不能包含外部 I/O 等无法回滚的副作用。实现不得为了简化接口而修改 `cy` 后再反推 dataset。

### 统一错误契约

`CausalError` 至少包含 `code`、可呈现的 `message`、相关 `ids`，以及可选的字段/行列位置。code 使用封闭联合：`InvalidInput`、`UnknownElement`、`DuplicateId`、`DanglingEdge`、`SnapshotMismatch`、`StaleResult`、`ReadOnlyDocument`、`SelectionLimit`、`ViewUnavailable`、`UnsupportedCapability`、`LayoutLoadFailed`、`Cancelled`、`TransactionFailed`。副作用操作和可能失败的分析统一返回 `Result`；纯 ID 查找的不存在值仍是 `undefined`。

取消不是成功，也不计入文档历史。错误不得包含原始导入文件全文等无关内容；保留足够的定位信息即可。

## 4. 查询与选择：使用领域 ID，不泄漏活的 Collection

```ts
const wet = query.nodes({ metadata: { category: "water" } });
const nearby = query.traverse({ from: ["rain"], direction: "out", depth: 2 });
const common = query.intersection(wet, nearby);
selection.set(common);
selection.all({ kind: "nodes", scope: "visible" });
selection.invert({ kind: "nodes", scope: "visible" });
selection.clear();
```

- 查询返回只读、脱离渲染器的 ID 集合或结果对象；旧结果不会在之后的修改中悄悄变化。结果带 `snapshotId` 和 `revision`。
- 普通查询默认当前**完整快照**。`scope: "visible"` 明确采用当前过滤结果；`scope: "selection"` 明确采用框架选择。隐藏元素与未选择元素不是同一种状态。
- `query.node(id)` / `query.edge(id)` 返回只读领域值或 `undefined`，元素查询包含 `nodes`、`edges`、`union`、`intersection`、`difference`、`filter`。
- `traverse` 统一表达邻居、入邻居、出邻居、前驱、后继及 BFS/DFS；返回有序访问节点和经过的边，注明是否包含起点。默认 `includeStart: false`；BFS/DFS 可显式指定包含起点。
- 查询过滤使用类型化字段或纯 predicate。CSS/Cytoscape 字符串选择器留给显式原生扩展入口，不作为领域查询语言。
- `selection.current()` 返回带版本信息的 `ElementSet`；`set`、`add`、`remove`、`toggle`、`all`、`invert`、`clear` 操作同一个框架选择状态。原有 `maxSelected` 继续限制节点数量，超限返回错误而不是随机截断；它不隐含一个边数量上限。
- 为覆盖原生框选/全选，统一选择模型应支持节点与边混选。旧 `graph.selected` 派生节点部分；旧 `selectedLink` 只在没有选中节点且仅选一条边时派生该 ID，否则为 null。既有 `toggleLink` 保留独占选边语义，新的 `selection.add` 才表示混选。详情面板在混选时显示摘要，不能任取第一条边当成单边详情。迁移时修改现有交互模块的状态结构，不额外保存一份多选列表。
- 结果用于修改前再次核对版本与 revision；跨版本或过期查询结果默认报错。调用方可以重新查询，不能把旧集合当成活绑定。
- 对仅有原生 `GraphView` 的调用方，用同一套纯 query 函数加显式 snapshot；不强制装上整个 Workspace。

## 5. 布局与视图：任务可等待、可取消

```ts
const task = view.layout("dagre", {
  target: selection.current(),
  includeNeighbors: true,
  fit: "target",
});
const outcome = await task.result;
if (outcome.ok) edit.setPositions(outcome.value.positions); // 明确保存

view.fit({ target: query.nodes(), padding: 40 });
view.center({ target: { nodes: ["water"] } });
view.zoom({ factor: 1.2, anchor: "center" });
view.pan({ by: { x: 40, y: 0 } });
```

`layout` 统一接受注册名或当前 `LayoutOptions`。内置 preset/grid/circle/concentric/breadthfirst/cose，以及 demo 的 dagre/cola/fcose/cose-bilkent/elk/cise，都走同一接口。可选扩展采用按需加载与幂等注册；加载失败返回可重试错误。

- 布局只移动 target 中的节点；`includeNeighbors` 扩充目标节点后，再明确构建参与布局的边。未参与节点的位置不变。支持复合节点的布局还需遵循分组约束。
- 返回 `Task<Result<{ positions, snapshotId, revision }>>`。`Task` 只有 `result: Promise<T>` 和 `cancel(): void`；结束状态明确包含取消、失败或成功。不得无限悬挂。
- 新布局取消同一视图的旧布局；切换版本、数据修改或实例销毁使旧结果失效。取消不提交中间位置，不污染已有稳定位置缓存。
- 镜头与节点布局是独立任务；新镜头运动只替换镜头运动，不停止节点动画。减弱动态效果设置对两者均有效。
- `view.positions()`、`view.reset()`、`view.controls({ zoom, pan, boxSelection, dragging })` 补齐读位置、重置镜头及四类交互开关。
- 拖动默认只改变视图。编辑器的 `persistPositions` 策略可在一次拖拽结束时提交一个位置事务，不能每一帧生成历史。
- 比较视图复用现有 anchoring 和位置缓存；公共布局入口不得绕开它们。

## 6. 样式、动画与事件

### 样式配置只保存规则，显示效果不修改模型

```tsx
<CausalProvider
  document={document}
  appearance={{
    nodes: { shape: "pill", color: "#52616b" },
    edges: { line: "bezier", arrows: "target" },
    rules: [{ selector: 'node[category = "weather"]', style: { "border-width": 3 } }],
  }}
/>
```

`appearance` 是拟议的配置便利层，编译到已有 theme / `CausalStyleOptions`。旧 `themes`、`styleOptions` 保持有效；同一项同时在新旧配置出现时，校验报冲突，不靠隐藏的优先级覆盖。

运行时使用 `appearance.set(...)`、`appearance.reset()` 修改会话样式。有限的一组常用字段覆盖颜色、形状、大小、线型、箭头和标签。补充有类型的 `mapData(field, { domain, range })`、`gradient(stops)`、`polygon(points)` 样式值构造器，覆盖数据映射、渐变与自定义多边形。高级曲线控制点、复合边和状态选择器继续接受原生 stylesheet 规则。常用字段必须给出类型，不能全部退化为 `Record<string, unknown>`。`appearance.rules` 除原生选择器外，应支持 `where: { kind: "node", metadata: { category: "weather" } }`，让普通类别样式不必学习 Cytoscape 选择器。

规则顺序：主题基础 → 应用规则 → 版本/因果语义 → hover/selection/keyboard 等交互状态。隐藏极性箭头或替换选择样式属于显式高级选项，不能由一个普通颜色修改意外触发。

临时动画用 `appearance.animate(target, effect, { duration, repeat, queue })`，返回可取消 Task。提供 pulse、flash、位置/样式关键帧、sequence/parallel；`queue: "replace"` 为默认，避免连续点击累积动画。`appearance.stop(target)` 停止该模块拥有的效果；恢复其覆盖前的规则，不清掉框架的选中状态。动画结束不暗中持久化节点坐标。

### 稳定的领域事件

```tsx
<CausalProvider
  document={document}
  events={{
    nodeTap: event => openDetails(event.nodeId),
    selectionChange: event => updateToolbar(event.selection),
    dragEnd: event => showPosition(event.nodeId, event.position),
  }}
/>
```

事件 payload 包含 `snapshotId`、`revision`、`viewId`、可区分的节点/边 ID、模型/屏幕坐标和来源（pointer/keyboard/programmatic）。默认不传递可写的 Cytoscape 实例或活 Collection。

覆盖 tap/doubleTap/contextTap、hover enter/leave、drag start/move/end、selection change、viewport change、文档 change、layout start/end。`on(type, handler)` 返回 unsubscribe；React prop 处理器始终使用最新回调，并自动在新实例重绑、旧实例清理。选择与编辑事件在相应状态提交后发出；同一事务合并通知。

手势提供小型组合器 `gestures.longPress(...)` / `gestures.swipe(...)`，共用 pointer 生命周期、取消与距离阈值；与当前环形菜单共享事件仲裁，不能一次长按同时触发两套动作。手势模块不重新实现编辑、选择或镜头状态。

## 7. 算法：结果可解释，查询不改图

```ts
const result = query.analyze({
  metric: "pagerank", // degree | betweenness | components | bridges | articulation
  scope: "snapshot",
  directed: true,
});

const routes = query.paths({
  from: "rain", to: "stress", mode: "all",
  directed: true, maxLength: 8, limit: 50,
});
```

- 默认遵循因果方向；degree 明确 in/out/total，连通性明确 weak/strong，不能让“components”隐含两种含义。
- `paths` 同时支持 shortest 与有上限的 all。权重字段、距离含义、不可达结果与负权限制必须写入契约。无权重时每边成本为 1；Dijkstra 模式拒绝负权。
- 桥与割点是无向结构性质：显式 `directed: false`（或 weak projection）才能运行。它们不等于因果强度，结果不写回节点 metadata。
- 所有分析都基于 snapshot/显式 projection；不得为了测试连通性临时从可见图删除节点或边。
- 结果包含 metric、scope、snapshotId、revision、参数和耗时。路径/回路还包含 `complete` 和截断原因，不能把局部结果标成全部。
- `query.analyze` / `query.paths` 返回 `Result<Report>`；`analyzeAsync` / `pathsAsync` 返回 `Task<Result<Report>>`，保留相同参数与报告字段。大任务使用异步、可取消版本并在 Worker 中执行；精确阈值由代表性数据测量后确定，不先承诺任意规模实时。
- K-means 使用 `query.cluster({ method: "kmeans", features, k, seed })`。位置聚类必须显式提供坐标特征和种子，返回分组与收敛状态；不把布局位置形成的簇称为因果社区。拓扑聚类通过另一种显式 method 扩展。
- 渲染分析结果使用 `appearance` 的独立覆盖层；不通过 `node.data("score", ...)` 偷改领域数据。需要保存评分时，由应用显式编辑 metadata。

## 8. 导入导出与视觉分组

### 先解析，再决定是否应用

```ts
const parsed = io.parse({ format: "dataset-json", text });
if (parsed.ok) edit.replaceDataset(parsed.value.dataset);

const output = await io.export({ format: "png", area: "graph", scale: 2 });
if (output.ok) io.download(output.value, "graph.png");
```

JSON/CSV 解码和编码放在 Core 的纯模块；浏览器的 File/Blob、图片渲染、下载放在相应适配器。`parse` 不修改当前图，返回校验问题、原始行列信息与转换警告。文件读取失败和数据校验失败分开报告。

- `dataset-json` 完整保留版本、证据、极性、对应关系和持久化位置。
- `cytoscape-json` 是显式兼容格式，必须通过转换器，不能把 renderer JSON 误认为 `CausalDataset`。
- `view-json` 单独保存镜头、过滤、临时外观和视觉分组，可携带数据集/版本标识；导入时检查目标，不覆盖领域数据。
- `csv-bundle` 返回 nodes、edges、snapshots、correspondences 等命名文件集合，不强制引入 ZIP。证据与 metadata 使用约定的 JSON 单元格；解析支持引号、逗号、换行、BOM 和空值。对外部列名提供显式映射。简化 CSV 导出必须报告无法保留的字段，不能默默丢失。
- `png` 支持 whole graph / viewport / target、透明或指定背景、scale，返回 Blob。未挂载或渲染器未就绪返回 `ViewUnavailable`，不静默不做事。
- `download` 是用户触发的浏览器便利操作，负责释放对象 URL；解析和导出本身不自动下载。

### 复合节点先表达为视觉分组

教程中父节点样式、子节点和复合布局需要比 CSS 包装更明确的模型。建议先提供 `view.groups`：`{ id, label, members, parentGroupId? }[]`。

分组表示视觉容器，不增加因果变量；Core 的路径、回路与统计只分析真实节点。渲染器生成的容器 ID 使用独立命名空间，不泄漏到领域查询结果。组的父子结构必须无环，成员必须存在，同一节点最多有一个直接父组。分组本身通过 `view-json` 保存。若产品以后需要真正的因果聚合节点，应另立领域设计，不能混用视觉分组。

复合布局、渐变、多边形、贝塞尔控制点等高级外观，由分组和 stylesheet 规则共同覆盖。支持哪些分组布局由注册的布局能力声明决定；不支持时返回错误，不悄悄忽略分组。

## 9. 功能覆盖表

“已有”表示当前存在公开的领域接口；“底层”表示需要接触 Core、编辑器内部或 renderer；“新增”表示该功能尚无相应公开便利入口。P0/P1/P2 是实施次序，均属于本设计范围。

| 编号 | demo / 教程功能 | 当前情况 | 拟议入口 | 阶段 |
| --- | --- | --- | --- | --- |
| S01 | 容器、初始化、销毁、浏览器加载 | 已有 GraphView | 保留 GraphView/CausalGraph，尺寸与生命周期由适配器管理 | P0 |
| S02 | zoom bounds、wheel、性能配置 | 底层/部分 props | view.controls + 有类型的 rendererOptions | P1 |
| S03 | 批量初始化元素、重置初始图 | 底层/replaceDataset | document.load / edit.replaceDataset | P0 |
| E01 | 添加单个节点/边、自动 ID | 编辑器内部 | edit.addNode / addEdge | P0 |
| E02 | 批量添加和批量 data 更新 | 底层 | edit.batch | P0 |
| E03 | 删除选中项、条件删除、删关联边 | 编辑器内部/纯 deleteNode | query + edit.remove | P0 |
| E04 | 修改 label、metadata、polarity、evidence | 编辑器内部/外部 React state | edit.updateNode / updateEdge | P0 |
| E05 | 修改或保存位置 | 底层/编辑器内部 | view.positions + edit.setPositions | P0 |
| E06 | 按 ID、类型、属性或 predicate 查询 | 底层 | query.node/edge/nodes/edges/filter | P0 |
| E07 | union、difference、intersection | 底层 | query 集合运算 | P0 |
| E08 | 邻居、入/出邻居、前驱/后继 | 部分 causes/effects | query.traverse | P1 |
| E09 | BFS / DFS 访问顺序 | 底层 | query.traverse 的 mode | P1 |
| L01 | preset/grid/circle/concentric/breadthfirst/cose | 已有 presets | view.layout | P1 |
| L02 | dagre/cola/fcose | 已有 presets/加载 | 同一 view.layout，按需注册 | P1 |
| L03 | cose-bilkent/elk/cise | 目前在学习 demo 内 | 带能力声明的布局注册 | P1 |
| L04 | 选中子图、邻居子图布局 | 底层 | view.layout 的 target/includeNeighbors | P1 |
| L05 | 布局参数、动画、开始/结束、取消 | 部分 relayout/Worker | Task + events + LayoutOptions | P1 |
| L06 | fit/center/zoom/pan/viewport reset | 部分 graph/view helpers | view.fit/center/zoom/pan/reset | P0 |
| L07 | 固定位置、布局缓存、版本锚定 | 已有 | 复用位置缓存和比较布局规则 | P1 |
| T01 | 节点 shape/color/size/label/border | 已有 styleOptions/rules | appearance 常用字段 | P1 |
| T02 | 数据映射、类别规则、自定义 polygon | 底层 stylesheet | appearance.rules，原生规则保留 | P1 |
| T03 | 线型、曲线、宽度、箭头、边标签 | 已有部分主题配置 | appearance.edges + rules | P1 |
| T04 | hover/selected/active/grabbed 样式 | 底层/框架自身 | 状态分层样式规则 | P1 |
| T05 | 渐变、多重/复合边与控制点 | 底层 | 高级 stylesheet 规则 | P2 |
| T06 | 父/子节点、复合节点样式 | 领域模型未定义 | view.groups + rules | P2 |
| T07 | pulse、flash、位置/样式动画 | 底层 | appearance.animate | P1 |
| T08 | sequence/parallel、队列、stop/reset | 底层 | 可取消效果 Task + queue 策略 | P2 |
| T09 | 动画性能与 reduced motion | 部分已有 motion | 统一 motion 策略与调度 | P1 |
| I01 | 用户 zoom/pan/box selection/drag 开关 | 底层 | view.controls | P0 |
| I02 | select all/clear/invert、多选上限 | 部分 graph methods | selection 模块 | P0 |
| I03 | tap/doubleTap/contextTap | 底层/部分 hook 内部 | 类型化 events | P1 |
| I04 | hover enter/leave、drag start/move/end | 底层 | 类型化 events | P1 |
| I05 | selection/zoom/pan/viewport 日志 | 底层 | 状态提交后的事件订阅 | P1 |
| I06 | add/remove/data 变化监听 | 底层 | document change 及事务变更摘要 | P0 |
| I07 | 委托处理、one/off、React 清理 | 底层 | on/unsubscribe、once 与 prop 回调 | P1 |
| I08 | 长按、拖拽方向/滑动手势 | 原生教程/部分环形菜单 | 可组合 gestures、事件仲裁 | P2 |
| I09 | tooltip / context menu 自定义 UI | 用户代码/环形菜单 | events payload + 宿主 UI slot | P1 |
| A01 | PageRank | 底层原生算法 | query.analyze metric=pagerank | P1 |
| A02 | degree、in/out degree | 底层 | query.analyze metric=degree | P1 |
| A03 | betweenness | 已有 Core | 复用现有纯算法，补参数契约 | P1 |
| A04 | 有向/无向最短路径、加权路径 | 部分因果路径 | query.paths mode=shortest | P1 |
| A05 | 全路径、路径高亮 | 已有有界因果路径/route | query.paths mode=all + appearance overlay | P1 |
| A06 | weak/strong components、结构分组 | 已有 SCC/底层 | query.analyze metric=components | P1 |
| A07 | 桥与割点、结果高亮 | 仅学习 demo 自定义实现 | 纯结构算法 + overlay | P1 |
| A08 | K-means、社区/分组显示 | 仅原生教程/demo | query.cluster + view.groups/overlay | P2 |
| A09 | 因果方向、极性、反馈回路 | 已有 Core/Worker | 保留现有接口，纳入统一查询结果 | P0 |
| A10 | 复杂度、结果数、截断、重置显示 | 分散 | analysis result metadata + overlay reset | P1 |
| D01 | JSON 导入与预览 | 现有 parser/领域 adapters | io.parse，确认后 edit.replaceDataset | P0 |
| D02 | 数据集 JSON 导出 | 编辑器 getDataset/用户代码 | io.export dataset-json | P0 |
| D03 | renderer JSON 兼容 | 原生 demo | 显式 cytoscape-json 转换器 | P1 |
| D04 | CSV 导入/导出、列映射 | 原生 demo，现有解析简化 | io.parse/export csv-bundle | P1 |
| D05 | PNG full/viewport/target、背景/比例 | 有固定配置下载 helper | io.export png + download | P1 |
| D06 | file 输入、格式错误、下载资源释放 | 各 demo 重复实现 | 浏览器 I/O 适配器 + Result | P1 |
| D07 | 文档重置、保留模型与视图差异 | 分散 | document.load / view.reset / view-json | P0 |

## 10. 兼容与原生扩展

1. 旧 `useCausal().graph`、`CausalWorkspace` props、`GraphView.onReady` 和 `CausalEditorApi` 保留；新接口优先复用这些实现，逐步让 Editor 内部命令迁移到统一编辑模块。
2. 不同时保留两套可写选择或历史状态。新的 facade 委托原有状态拥有者；旧方法成为兼容调用路径，而非双向同步的第二份状态。
3. 原生扩展暂继续使用 `GraphView.onReady` / 现有 `graph.cy`。高层操作不得要求调用者先保存 `cyRef`，也不新增长期存活的全局 `cy`。
4. renderer-only 扩展可以访问高级样式、插件与原生事件。原生 `cy.add/remove/data` 不会被神奇地捕获并同步到领域数据；文档修改必须经过 edit。
5. 节点分组、CSV 中的未知列、权重含义和社区定义需要显式 schema/参数。禁止用一个泛化 `execute(string, any)` 绕过类型与语义。

## 11. 实施与验收

### P0：建立统一状态与常用命令

先抽取文档编辑和历史模块，再接入 Editor 与 Provider。完成 CRUD、事务、选择集合、基本镜头/输入控制、JSON 数据流和事件变更摘要。首先用新接口重写 elements/events/data 的少量 Cytocausal 对照示例；只展示该章操作所需的图和控件，不嵌入整个 Workspace。

### P1：覆盖布局、样式和分析的主要操作

接入布局任务与扩展注册，复用现有 Worker/缓存/锚定。补类型化事件、常用 appearance、各类分析与 CSV/PNG。七章各有独立的 Cytocausal 示例页，提供 Preview/Code 和实际源文件；原生 React/vanilla 页继续保留作为参照。

### P2：完整覆盖高级教学功能

实现视觉分组、复合布局、渐变与高级边规则、效果序列和手势组合，以及显式特征的聚类。每项必须补充 capability、性能与导出限制，不能把“可直接调用 cy”作为高层接口已经完成的证明。

### 必须通过的行为验收

- 同一编辑命令在工具栏、键盘和 Editor 中具有同样结果；一次 batch 对应一次 undo/redo。
- 无效命令不改变文档、revision、选择或历史；删除清理关联边与对应关系。
- 两个 Provider 共享数据修改，但版本、选择、镜头不互相污染。
- selection 的按钮、框选、搜索、键盘、侧栏读取同一状态；过滤范围明确。
- 布局取消、版本切换、卸载和实例重建时，没有陈旧位置写入、泄漏订阅或悬挂任务。
- 普通样式更新、分析、pulse/flash 和查询不改变因果数据；高亮不会抹去选中态。
- 桥/割点分析前后所有节点、边和数据完全一致；有向/无向及权重语义有小图基准验证。
- JSON 与完整 CSV 往返保留快照、证据、极性、metadata、对应关系；不支持的数据必须显式报错/警告。
- Code 页按需读取正在运行的源文件，Preview/Code 切换不丢编辑状态；中英文示例路径一致。
- 无 renderer 时纯查询和编码仍可运行；图片和镜头命令返回明确的能力错误。

## 12. 需要评审的选择

推荐先确认这三个选择，再冻结公开类型：

1. **使用统一 Document，并保持旧 dataset 模式只读。** 避免应用为了一个添加按钮就挂载整套 Editor。
2. **按六个职责组织 `useCausal`。** 避免几十个无分组方法，也避免逐项照搬 Cytoscape Collection。
3. **把视觉分组与因果节点分开。** 保持现有领域算法与数据兼容；真正的聚合语义留给独立领域设计。

API 拼写、具体字段名和异步算法的执行阈值仍可调整；状态归属、事务原子性、版本范围和能力错误应先固定。
