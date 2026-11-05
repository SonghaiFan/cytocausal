import type { ReactNode } from "react";
import { Head, Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, LocaleSwitch, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import type { Language } from "@/lib/chapters";

const locales = [
  { locale: "en", name: "English" },
  { locale: "zh-cn", name: "简体中文" },
];

/** The site shell for guides and demos. Only guides have a locale in the path to switch. */
export async function DocsShell({
  lang,
  localeSwitch = false,
  children,
}: {
  lang: Language;
  localeSwitch?: boolean;
  children: ReactNode;
}) {
  const chinese = lang === "zh-cn";
  return (
    <html lang={chinese ? "zh-CN" : "en"} dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar logo={<b>cytocausal</b>}>
              {localeSwitch && <LocaleSwitch lite />}
            </Navbar>
          }
          footer={<Footer>cytocausal</Footer>}
          pageMap={await getPageMap(`/${lang}`)}
          i18n={localeSwitch ? locales : []}
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
