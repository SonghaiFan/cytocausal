import type { ReactNode } from "react";
export function ExampleLayout({ description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="example-layout">{description && <p className="example-description">{description}</p>}<div className="example-sections">{children}</div></div>;
}
