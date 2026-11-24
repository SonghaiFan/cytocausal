"use client";
import { useState } from "react";
import { CausalGraph, CausalProvider, useCausal, useCausalDocument, useCausalDocumentState } from "@cytocausal/react";
import type { CausalDataset, CausalResult } from "@cytocausal/core";
import type { LayoutOptions } from "cytoscape";
import type { TutorialTopic } from "../topics.ts";
import "@cytocausal/react/styles.css";

const dataset: CausalDataset = { id: "plant-water", snapshots: [{ id: "draft", nodes: [
  { id: "rain", label: "Rain", metadata: { category: "weather" } }, { id: "water", label: "Soil water" }, { id: "stress", label: "Plant water stress" },
], edges: [
  { id: "rain-water", source: "rain", target: "water", polarity: "positive" },
  { id: "water-stress", source: "water", target: "stress", polarity: "negative" },
] }] };
const layout: LayoutOptions = { name: "breadthfirst", directed: true, padding: 40 };

export default function CommandsExample({ topic, lang }: { topic: TutorialTopic; lang: "en" | "zh-cn" }) {
  const document = useCausalDocument({ initialDataset: dataset });
  return <CausalProvider document={document} layout={layout} className="commands-example" shareInUrl={false}>
    <Commands topic={topic} chinese={lang === "zh-cn"} />
  </CausalProvider>;
}
function Commands({ topic, chinese }: { topic: TutorialTopic; chinese: boolean }) {
  const { document, edit, selection, snapshot, view, io, query } = useCausal();
  const state = useCausalDocumentState(document!);
  const [message, setMessage] = useState("");
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(true);
  const t = (en: string, zh: string) => chinese ? zh : en;
  function report(result: CausalResult<unknown>) {
    setMessage(result.ok ? t("Done", "已完成") : `${result.error.code}: ${result.error.message}`);
  }
  if (!edit) return null;
  const chosen = selection.current();
  return <>
    <p>{t("Relationships are example assumptions. Editing the graph does not establish causation.", "关系是示例假设；编辑或显示图形不能证明因果关系。")}</p>
    <div className="commands-toolbar">
      {topic === "elements" && <>
        <button onClick={() => report(edit.batch("Add sunlight", draft => {
          const sun = draft.addNode({ label: "Sunlight", metadata: { category: "weather" } });
          draft.addEdge({ source: sun.id, target: "water", polarity: "negative" });
        }))}>{t("Add sunlight + link", "添加阳光及关系")}</button>
        <button disabled={!chosen.nodes?.length && !chosen.edges?.length} onClick={() => report(edit.remove(selection.current()))}>{t("Delete selected", "删除选中项")}</button>
        <button onClick={() => report(selection.set(query.nodes({ metadata: { category: "weather" } })))}>{t("Select weather nodes", "选择天气节点")}</button>
      </>}
      {(topic === "elements" || topic === "events") && <>
        <button onClick={() => report(selection.all({ kind: "nodes" }))}>{t("Select all nodes", "选择所有节点")}</button>
        <button onClick={() => report(selection.all())}>{t("Select all elements", "选择所有元素")}</button>
        <button onClick={() => report(selection.invert())}>{t("Invert selection", "反选")}</button>
        <button onClick={() => report(selection.clear())}>{t("Clear selection", "清除选择")}</button>
      </>}
      {topic === "events" && <>
        <button onClick={() => report(view.zoom({ factor: 1.2 }))}>{t("Zoom in", "放大")}</button>
        <button onClick={() => report(view.pan({ by: { x: 40, y: 0 } }))}>{t("Pan right", "向右平移")}</button>
        <button onClick={() => { const result = view.controls({ dragging: !dragging }); report(result); if (result.ok) setDragging(value => !value); }}>{t("Toggle dragging", "切换拖拽")}</button>
      </>}
      <button onClick={() => report(view.fit())}>{t("Fit", "适配视图")}</button>
      <button disabled={!state.canUndo} onClick={() => report(edit.undo())}>{t("Undo", "撤销")}</button>
      <button disabled={!state.canRedo} onClick={() => report(edit.redo())}>{t("Redo", "重做")}</button>
      <button onClick={() => report(document!.load(dataset))}>{t("Reset document", "重置文档")}</button>
    </div>
    <p className="commands-summary" role="status">{snapshot.nodes.length} {t("nodes", "个节点")} · {snapshot.edges.length} {t("links", "条关系")} · {chosen.nodes?.length ?? 0}/{chosen.edges?.length ?? 0} {t("selected nodes/links", "个选中节点/关系")} · {t("revision", "修订")} {state.revision}</p>
    <div className="commands-graph"><CausalGraph /></div>
    {topic === "data" && <>
      <div className="commands-toolbar">
        <button onClick={() => { const result = io.export({ format: "dataset-json" }); if (result.ok) setText(result.value); report(result); }}>{t("Export JSON", "导出 JSON")}</button>
        <button onClick={() => { const result = io.parse({ format: "dataset-json", text }); if (result.ok) report(edit.replaceDataset(result.value.dataset)); else report(result); }}>{t("Apply JSON", "应用 JSON")}</button>
      </div>
      <label>{t("Causal dataset JSON", "因果数据集 JSON")}<textarea value={text} onChange={event => setText(event.target.value)} rows={12} /></label>
    </>}
    <p role="status">{message}</p>
  </>;
}
