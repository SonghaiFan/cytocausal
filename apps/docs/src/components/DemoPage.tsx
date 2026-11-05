import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import type { ReactNode } from "react";
import { codeToHtml } from "shiki";
import { DemoViewer } from "@/components/DemoViewer";
import { chapters, type Language } from "@/lib/chapters";
import { useMDXComponents as getMDXComponents } from "@/mdx-components";
import "@/styles/demo.css";

type Mode = "react" | "vanilla";

const Wrapper = getMDXComponents().wrapper as React.ComponentType<Record<string, unknown>>;
const shikiLanguage = (file: string) => path.extname(file).slice(1);

/** Follows relative imports from an example so readers see every file it uses. */
async function collectSources(entries: string[]) {
  const sources = new Map<string, string>();
  const visit = async (file: string) => {
    if (sources.has(file)) return;
    sources.set(file, await readFile(file, "utf8"));
    if (!file.startsWith("src/")) return;
    const imports = sources.get(file)!.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g);
    for (const [, specifier] of imports) {
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      const base = specifier.startsWith("@/")
        ? `src/${specifier.slice(2)}`
        : path.posix.join(path.posix.dirname(file), specifier);
      for (const extension of [".tsx", ".ts"]) {
        try {
          await visit(base + extension);
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
  };
  for (const entry of entries) await visit(entry);
  return Promise.all(
    [...sources].map(async ([file, code]) => ({
      name: file.replace(/^(src|public)\//, ""),
      code,
      html: await codeToHtml(code, { lang: shikiLanguage(file), theme: "github-dark" }),
    })),
  );
}

export async function DemoPage({
  topic,
  mode,
  lang,
  children,
}: {
  topic: string;
  mode: Mode;
  lang: Language;
  children: ReactNode;
}) {
  const chapter = chapters.find((c) => c.topic === topic)!;
  const chinese = lang === "zh-cn";
  const title = chinese ? chapter.zh : chapter.title;
  const demoUrl = (name: string) =>
    mode === "react" ? `/examples/react/${name}/` : `/examples/vanilla/${lang}/${name}/`;
  const files = await collectSources(
    mode === "react"
      ? [`src/examples/${chapter.slug}/page.tsx`]
      : [
          `public/demos/vanilla/${lang}/${topic}.html`,
          "public/demo-frame.css",
          "public/demo-frame.js",
          "public/demo-controls.css",
        ],
  );

  return (
    <Wrapper toc={[]} metadata={{ title, filePath: "" }} sourceCode="">
      <h1 className="demo-title">{title}</h1>
      <nav className="demo-tabs" aria-label="Chapter views">
        <a href={`/${lang}/${topic}/`}>{chinese ? "教程" : "Guide"}</a>
        <a href={`/examples/react/${topic}/`} aria-current={mode === "react" ? "page" : undefined}>
          React
        </a>
        <a
          href={`/examples/vanilla/${lang}/${topic}/`}
          aria-current={mode === "vanilla" ? "page" : undefined}
        >
          Vanilla JS
        </a>
        <a className="other-language" href={`/${chinese ? "en" : "zh-cn"}/${topic}/`}>
          {chinese ? "English guide" : "中文教程"}
        </a>
      </nav>
      <nav className="demo-chapters" aria-label={chinese ? "章节" : "Chapters"}>
        {chapters.map((c) => (
          <Link
            key={c.topic}
            href={demoUrl(c.topic)}
            aria-current={c.topic === topic ? "page" : undefined}
          >
            {c.number}. {chinese ? c.zh : c.title}
          </Link>
        ))}
      </nav>
      <DemoViewer files={files} chinese={chinese}>
        {children}
      </DemoViewer>
    </Wrapper>
  );
}
