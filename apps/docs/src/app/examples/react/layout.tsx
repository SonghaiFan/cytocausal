import type { ReactNode } from "react";
import { DocsShell } from "@/components/DocsShell";

/** The React playgrounds are written in Chinese. */
export default function ReactDemoLayout({ children }: { children: ReactNode }) {
  return <DocsShell lang="zh-cn">{children}</DocsShell>;
}
