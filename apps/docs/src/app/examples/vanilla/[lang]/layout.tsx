import type { ReactNode } from "react";
import { DocsShell } from "@/components/DocsShell";
import type { Language } from "@/lib/chapters";

export const dynamicParams = false;
export const generateStaticParams = () => [{ lang: "en" }, { lang: "zh-cn" }];

export default async function VanillaDemoLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return <DocsShell lang={lang as Language}>{children}</DocsShell>;
}
