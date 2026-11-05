"use client";
import dynamic from "next/dynamic";

// Cytoscape needs the DOM, so playgrounds only render in the browser
const loading = () => <p>Loading interactive graph…</p>;
const playgrounds: Record<string, React.ComponentType> = {
  setup: dynamic(() => import("@/examples/1-setup/page"), { ssr: false, loading }),
  elements: dynamic(() => import("@/examples/2-elements/page"), { ssr: false, loading }),
  layouts: dynamic(() => import("@/examples/3-layout/page"), { ssr: false, loading }),
  styles: dynamic(() => import("@/examples/4-style/page"), { ssr: false, loading }),
  events: dynamic(() => import("@/examples/5-events/page"), { ssr: false, loading }),
  algorithms: dynamic(() => import("@/examples/6-algorithms/page"), { ssr: false, loading }),
  data: dynamic(() => import("@/examples/7-data/page"), { ssr: false, loading }),
};

export function Playground({ topic }: { topic: string }) {
  const Example = playgrounds[topic];
  return <Example />;
}
