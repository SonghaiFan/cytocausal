import { appLinks } from "./app-links.ts";
import Link from "next/link";
import { assetPath } from "./site-path.ts";
import type { ReactNode } from "react";
import { Head, Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, LocaleSwitch, Navbar } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import "./shell.css";


export type Language = "en" | "zh-cn";

const locales = [
  { locale: "en", name: "English" },
  { locale: "zh-cn", name: "简体中文" },
];

export async function DocsShell({ lang, children }: { lang: Language; children: ReactNode }) {
  const chinese = lang === "zh-cn";
  return (
    <html lang={chinese ? "zh-CN" : "en"} dir="ltr" suppressHydrationWarning>
      <Head color={{ hue: 46, saturation: 85, lightness: { light: 30, dark: 65 } }} />
      <body>
        <Layout
          navbar={
            <Navbar logoLink={`/${lang}/`} logo={<span className="cc-brand"><img src={assetPath("/brand/mark.svg")} width="30" height="30" alt="" /><img className="cc-wordmark-light" src={assetPath("/brand/wordmark.svg")} width="138" height="30" alt="cytocausal" /><img className="cc-wordmark-dark" src={assetPath("/brand/wordmark-dark.svg")} width="138" height="30" alt="cytocausal" /></span>} projectLink="https://github.com/SonghaiFan/cytocausal">
              <Link className="cc-nav-link" href={`/${lang}/getting-started/`}>{chinese ? "文档" : "Docs"}</Link>
              <Link className="cc-nav-link" href={`/${lang}/showcase/`}>Showcase</Link>
              <Link className="cc-nav-link" href={`/${lang}/examples/`}>
                {chinese ? "示例" : "Examples"}
              </Link>
              <Link className="cc-nav-link" href={`/${lang}/api-core/`}>
                API
              </Link>
              <Link className="cc-nav-link cc-nav-studio" href={appLinks.studio}>Studio ↗</Link>
              <LocaleSwitch lite />
            </Navbar>
          }
          footer={<Footer><span style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 16 }}><span>cytocausal</span><span role="img" aria-label="Frank" style={{ display: "block", width: 48, height: 20, background: "currentColor", opacity: 0.7, mask: `url(${assetPath("/brand/frank-signature.svg")}) center / contain no-repeat`, WebkitMask: `url(${assetPath("/brand/frank-signature.svg")}) center / contain no-repeat` }} /></span></Footer>}
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
