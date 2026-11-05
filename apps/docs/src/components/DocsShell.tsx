import type { ReactNode } from "react";
import { Head, Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, LocaleSwitch, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";

export type Language = "en" | "zh-cn";

const locales = [
  { locale: "en", name: "English" },
  { locale: "zh-cn", name: "简体中文" },
];

export async function DocsShell({ lang, children }: { lang: Language; children: ReactNode }) {
  const chinese = lang === "zh-cn";
  return (
    <html lang={chinese ? "zh-CN" : "en"} dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar logo={<b>cytocausal</b>} projectLink="https://github.com/SonghaiFan/cytocausal">
              <LocaleSwitch lite />
            </Navbar>
          }
          footer={<Footer>cytocausal</Footer>}
          pageMap={await getPageMap(`/${lang}`)}
          i18n={locales}
          search={<Search placeholder={chinese ? "搜索文档…" : "Search docs…"} />}
          editLink={null}
          feedback={{ content: null }}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
