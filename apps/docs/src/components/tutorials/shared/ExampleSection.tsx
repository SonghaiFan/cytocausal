import type { ReactNode } from "react";
export function ExampleSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return <section className="example-section">{title && <h2>{title}</h2>}{description && <p className="example-description">{description}</p>}{children}</section>;
}
