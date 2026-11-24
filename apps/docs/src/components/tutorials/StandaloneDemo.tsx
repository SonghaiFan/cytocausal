"use client";
import { useEffect, useRef, useState } from "react";
import { TutorialPlayground, type TutorialMode } from "./TutorialPlayground.tsx";
import type { TutorialTopic } from "./topics.ts";
import sources from "./sources.json";
import { assetPath } from "../site-path.ts";

export function StandaloneDemo({ topic, lang, mode }: { topic: TutorialTopic; lang: "en" | "zh-cn"; mode: TutorialMode }) {
  const chinese = lang === "zh-cn";
  const files = sources[topic].filter(file => mode === "cytocausal"
    ? file.name.startsWith("framework/") || file.name === "topics.ts" || file.name === "tutorials.css"
    : mode === "vanilla"
    ? file.name.startsWith(`vanilla/${lang}/`) || file.name.startsWith("demo-")
    : !file.name.startsWith("vanilla/") && !file.name.startsWith("demo-") && !file.name.startsWith("framework/"));
  const [view, setView] = useState<"preview" | "code">("preview");
  const [fileName, setFileName] = useState(files[0].name);
  const file = files.find(file => file.name === fileName) ?? files[0];
  const [source, setSource] = useState<{ url: string; code: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const previewTab = useRef<HTMLButtonElement>(null);
  const codeTab = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (view !== "code") return;
    const controller = new AbortController();
    setError(""); setCopied("");
    fetch(assetPath(file.url), { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }).then(code => setSource({ url: file.url, code })).catch(error => {
      if (!controller.signal.aborted) setError(String(error));
    });
    return () => controller.abort();
  }, [view, file.url]);
  const currentSource = source?.url === file.url ? source.code : "";
  return <>
    <div role="tablist" aria-label={chinese ? "示例视图" : "Example view"} className="demo-view-tabs" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "preview" : event.key === "End" ? "code" : view === "preview" ? "code" : "preview";
      setView(next); (next === "preview" ? previewTab : codeTab).current?.focus();
    }}>
      <button ref={previewTab} role="tab" id="preview-tab" aria-selected={view === "preview"} aria-controls="preview-panel" tabIndex={view === "preview" ? 0 : -1} onClick={() => setView("preview")}>{chinese ? "预览" : "Preview"}</button>
      <button ref={codeTab} role="tab" id="code-tab" aria-selected={view === "code"} aria-controls="code-panel" tabIndex={view === "code" ? 0 : -1} onClick={() => setView("code")}>{chinese ? "源码" : "Code"}</button>
    </div>
    <div id="preview-panel" role="tabpanel" aria-labelledby="preview-tab" hidden={view !== "preview"}><TutorialPlayground topic={topic} mode={mode} lang={lang} /></div>
    <div id="code-panel" role="tabpanel" aria-labelledby="code-tab" hidden={view !== "code"}>
      <div className="source-file-controls">
        <label>{chinese ? "源文件" : "Source file"}<select value={file.name} onChange={event => setFileName(event.target.value)}>{files.map(file => <option key={file.name} value={file.name}>{file.name}</option>)}</select></label>
        <a href={assetPath(file.url)} target="_blank" rel="noreferrer">{chinese ? "打开源文件 ↗" : "Open source file ↗"}</a>
        <button disabled={!currentSource} onClick={async () => {
          try { await navigator.clipboard.writeText(currentSource); setCopied(chinese ? "已复制" : "Copied"); }
          catch { setCopied(chinese ? "请选择代码后复制" : "Select the code to copy manually"); }
        }}>{chinese ? "复制" : "Copy"}</button>
        <span role="status">{copied}</span>
      </div>
      {error ? <p role="alert">{chinese ? "无法加载源文件" : "Could not load source file"}: {error}</p> : !currentSource ? <p role="status">{chinese ? "正在加载源文件…" : "Loading source file…"}</p> : <pre tabIndex={0}><code>{currentSource}</code></pre>}
    </div>
  </>;
}
