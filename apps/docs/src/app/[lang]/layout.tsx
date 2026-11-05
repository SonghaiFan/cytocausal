import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DocsShell } from "@/components/DocsShell";
import type { Language } from "@/lib/chapters";

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
    <DocsShell lang={lang as Language} localeSwitch>
      {children}
    </DocsShell>
  );
}
