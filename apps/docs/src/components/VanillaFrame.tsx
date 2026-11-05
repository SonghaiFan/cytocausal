"use client";
import { useEffect, useRef } from "react";

/** Hosts a standalone demo, following the site theme and the demo's height. */
export function VanillaFrame({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current!;
    const syncTheme = () => {
      const root = frame.contentDocument?.documentElement;
      if (root) {
        root.dataset.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      }
    };
    const resize = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.contentWindow ||
        event.data?.type !== "demo:resize"
      ) {
        return;
      }
      const height = Number(event.data.height);
      if (Number.isFinite(height) && height > 0) {
        frame.style.height = `${Math.min(15000, Math.ceil(height) + 8)}px`;
      }
    };
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    frame.addEventListener("load", syncTheme);
    window.addEventListener("message", resize);
    syncTheme();
    return () => {
      themeObserver.disconnect();
      frame.removeEventListener("load", syncTheme);
      window.removeEventListener("message", resize);
    };
  }, []);

  return <iframe ref={frameRef} className="demo-frame" src={src} title={title} />;
}
