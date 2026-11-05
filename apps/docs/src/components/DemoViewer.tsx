"use client";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type SourceFile = { name: string; code: string; html: string };
type Mode = "preview" | "code";

/** Switches a demo between its live preview and its source files. */
export function DemoViewer({
  files,
  chinese,
  children,
}: {
  files: SourceFile[];
  chinese: boolean;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("preview");
  const [fileIndex, setFileIndex] = useState(0);
  const [status, setStatus] = useState("");
  const tabs = useRef<Record<Mode, HTMLButtonElement | null>>({ preview: null, code: null });

  const activate = (next: Mode, focus = false) => {
    setMode(next);
    if (focus) tabs.current[next]?.focus();
    if (next === "preview") requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const other = mode === "preview" ? "code" : "preview";
    activate(event.key === "Home" ? "preview" : event.key === "End" ? "code" : other, true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(files[fileIndex].code);
      setStatus(chinese ? "已复制" : "Copied");
    } catch {
      setStatus(chinese ? "复制失败" : "Copy failed");
    }
  };

  const tab = (value: Mode, label: string) => (
    <button
      ref={(element) => {
        tabs.current[value] = element;
      }}
      id={`${value}-tab`}
      role="tab"
      type="button"
      aria-selected={mode === value}
      aria-controls={`${value}-panel`}
      tabIndex={mode === value ? 0 : -1}
      onClick={() => activate(value)}
      onKeyDown={onKeyDown}
    >
      {label}
    </button>
  );

  return (
    <div className="demo-viewer">
      <div className="viewer-toolbar" role="tablist" aria-label={chinese ? "示例视图" : "Example view"}>
        {tab("preview", chinese ? "预览" : "Preview")}
        {tab("code", chinese ? "代码" : "Code")}
      </div>
      <div id="preview-panel" role="tabpanel" aria-labelledby="preview-tab" tabIndex={0} hidden={mode !== "preview"}>
        {children}
      </div>
      <div id="code-panel" role="tabpanel" aria-labelledby="code-tab" tabIndex={0} hidden={mode !== "code"}>
        <div className="source-toolbar">
          <label>
            {chinese ? "源文件" : "Source file"}
            <select
              value={fileIndex}
              onChange={(event) => {
                setFileIndex(Number(event.target.value));
                setStatus("");
              }}
            >
              {files.map((file, index) => (
                <option key={file.name} value={index}>
                  {file.name}
                </option>
              ))}
            </select>
          </label>
          <button className="copy-source" type="button" onClick={copy}>
            {chinese ? "复制" : "Copy"}
          </button>
          <span className="copy-status" role="status">
            {status}
          </span>
        </div>
        <div className="source-file" dangerouslySetInnerHTML={{ __html: files[fileIndex].html }} />
      </div>
    </div>
  );
}
