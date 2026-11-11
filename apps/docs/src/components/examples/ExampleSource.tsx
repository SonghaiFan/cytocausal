import "./examples.css";
import sources from "./sources.json";
export function ExampleSource({ name }: { name: keyof typeof sources }) {
  return <details className="example-source"><summary>{name}</summary><pre><code>{sources[name]}</code></pre></details>;
}
