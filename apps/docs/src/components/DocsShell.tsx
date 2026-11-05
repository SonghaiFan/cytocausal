import type { ReactNode } from "react";
import { Head, Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, LocaleSwitch, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import type { Language } from "@/lib/chapters";

type PageMap = Awaited<ReturnType<typeof getPageMap>>;

/** Demo pages aren't under a language, so their sidebar links must name one. */
const withLanguage = (pageMap: PageMap, lang: Language): PageMap =>
  pageMap.map((item) => {
    if (!("route" in item)) return item;
    const route = `/${lang}${item.route === "/" ? "" : item.route}`;
    return "children" in item
      ? { ...item, route, children: withLanguage(item.children, lang) }
      : { ...item, route };
  });

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
  const pageMap = await getPageMap(`/${lang}`);
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
          pageMap={localeSwitch ? pageMap : withLanguage(pageMap, lang)}
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
