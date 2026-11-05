import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsShell, type Language } from "@/components/DocsShell";

// Any other first segment would reach Nextra as an unknown locale and crash
export const dynamicParams = false;
export const generateStaticParams = () => [{ lang: "en" }, { lang: "zh-cn" }];

export const metadata: Metadata = {
  title: { default: "cytocausal", template: "%s | cytocausal" },
};

export default async function GuideLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <DocsShell lang={lang as Language}>
      {children}
    </DocsShell>
  );
}
