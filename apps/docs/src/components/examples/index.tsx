"use client";
import dynamic from "next/dynamic";
import "./examples.css";
const loading = () => <p role="status">Loading example… / 正在加载示例…</p>;
const demos = {
  workspace: dynamic(() => import("./WorkspaceExample.tsx"), { ssr: false, loading }),
  compose: dynamic(() => import("./ComposeExample.tsx"), { ssr: false, loading }),
  versions: dynamic(() => import("./VersionsExample.tsx"), { ssr: false, loading }),
  analysis: dynamic(() => import("./AnalysisExample.tsx"), { ssr: false, loading }),
};
export function LibraryExample({ name }: { name: keyof typeof demos }) {
  const Demo = demos[name];
  return <div className={`library-example library-example-${name}`}><Demo /></div>;
}
