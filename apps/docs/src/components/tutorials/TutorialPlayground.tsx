"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { assetPath } from "../site-path.ts";
import type { TutorialTopic } from "./topics.ts";
import "./tutorials.css";

const loading = () => <p role="status">Loading playground… / 正在加载示例…</p>;
const examples = {
  setup: dynamic(() => import("./react/1-setup/page.tsx"), { ssr: false, loading }),
  elements: dynamic(() => import("./react/2-elements/page.tsx"), { ssr: false, loading }),
  layouts: dynamic(() => import("./react/3-layout/page.tsx"), { ssr: false, loading }),
  styles: dynamic(() => import("./react/4-style/page.tsx"), { ssr: false, loading }),
  events: dynamic(() => import("./react/5-events/page.tsx"), { ssr: false, loading }),
  algorithms: dynamic(() => import("./react/6-algorithms/page.tsx"), { ssr: false, loading }),
  data: dynamic(() => import("./react/7-data/page.tsx"), { ssr: false, loading }),
};
const Commands = dynamic(() => import("./framework/CommandsExample.tsx"), { ssr: false, loading });
export type TutorialMode = "vanilla" | "react" | "cytocausal";

export function TutorialPlayground({ topic, lang, mode }: { topic: TutorialTopic; lang: "en" | "zh-cn"; mode: TutorialMode }) {
  const chinese = lang === "zh-cn";
  const [reactKey, setReactKey] = useState(0);
  const [frameHeight, setFrameHeight] = useState(640);
  const frame = useRef<HTMLIFrameElement>(null);
  const Demo = examples[topic];

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "demo:resize" && Number.isFinite(event.data.height)) {
        setFrameHeight(Math.max(480, Math.min(2200, event.data.height + 8)));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return <section className="cy-tutorial" aria-label={chinese ? "Cytoscape.js 基础示例" : "Cytoscape.js foundations playground"}>
    <div className="tutorial-controls">
      <button type="button" onClick={() => {
        if (mode === "vanilla" && frame.current) frame.current.src = frame.current.src;
        else setReactKey(value => value + 1);
      }}>{chinese ? "重置示例" : "Reset example"}</button>
    </div>
    <div hidden={mode !== "vanilla"}>
      {mode === "vanilla" && <iframe ref={frame} title={`${topic} — ${chinese ? "原生 JavaScript 示例" : "vanilla JavaScript example"}`} src={assetPath(`/tutorials/vanilla/${lang}/${topic}.html`)} style={{ height: frameHeight }} />}
    </div>
    {mode === "cytocausal" && <Commands key={reactKey} topic={topic} lang={lang} />}
    <div className="react-demo" hidden={mode !== "react"}>
      {!chinese && <p className="tutorial-note">The original React playground uses Chinese control labels; choose Vanilla JavaScript for English controls.</p>}
      {mode === "react" && <Demo key={reactKey} />}
    </div>
  </section>;
}
