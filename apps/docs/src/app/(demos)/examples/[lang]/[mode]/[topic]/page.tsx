import { notFound } from "next/navigation";
import { tutorialChapters, commandTopics } from "@/components/tutorials/topics.ts";
import { StandaloneDemo } from "@/components/tutorials/StandaloneDemo.tsx";
import { assetPath } from "@/components/site-path.ts";

export const dynamicParams = false;
export function generateStaticParams() {
  return ["en", "zh-cn"].flatMap(lang => ["react", "vanilla", "cytocausal"].flatMap(mode => tutorialChapters.filter(({ topic }) => mode !== "cytocausal" || commandTopics.includes(topic)).map(({ topic }) => ({ lang, mode, topic }))));
}
type Props = { params: Promise<{ lang: string; mode: string; topic: string }> };
export async function generateMetadata({ params }: Props) {
  const { lang, mode, topic } = await params;
  const chapter = tutorialChapters.find(chapter => chapter.topic === topic);
  return { title: `${lang === "zh-cn" ? chapter?.zh : chapter?.title} — ${mode === "cytocausal" ? "Cytocausal" : mode === "react" ? "React" : "Vanilla JS"} · Cytoscape.js` };
}
export default async function DemoPage({ params }: Props) {
  const { lang, mode, topic } = await params;
  const chapter = tutorialChapters.find(chapter => chapter.topic === topic);
  if (!chapter || (lang !== "en" && lang !== "zh-cn") || (mode !== "react" && mode !== "vanilla" && mode !== "cytocausal") || (mode === "cytocausal" && !commandTopics.includes(chapter.topic))) notFound();
  const chinese = lang === "zh-cn";
  const path = (mode: string) => assetPath(`/examples/${lang}/${mode}/${topic}/`);
  return <div className="standalone-demo" lang={chinese ? "zh-CN" : "en"}>
    <header className="demo-header"><a href={assetPath(`/${lang}/cytoscape-basics/`)}>Cytoscape.js</a><span>{chinese ? "交互示例" : "Interactive examples"}</span><a href={assetPath(`/examples/${chinese ? "en" : "zh-cn"}/${mode}/${topic}/`)}>{chinese ? "English" : "简体中文"}</a></header>
    <div className="demo-shell">
      <aside><nav aria-label={chinese ? "示例章节" : "Example chapters"}>{tutorialChapters.filter(item => mode !== "cytocausal" || commandTopics.includes(item.topic)).map((item) => <a key={item.topic} href={assetPath(`/examples/${lang}/${mode}/${item.topic}/`)} aria-current={item.topic === topic ? "page" : undefined}>{tutorialChapters.indexOf(item) + 1}. {chinese ? item.zh : item.title}</a>)}</nav></aside>
      <main>
        <h1>{chinese ? chapter.zh : chapter.title}</h1>
        <nav className="demo-navigation" aria-label={chinese ? "章节视图" : "Chapter views"}>
          <a href={assetPath(`/${lang}/cytoscape-basics/${topic}/`)}>{chinese ? "教程" : "Tutorial"}</a>
          <a href={path("vanilla")} aria-current={mode === "vanilla" ? "page" : undefined}>Vanilla JavaScript</a>
          <a href={path("react")} aria-current={mode === "react" ? "page" : undefined}>React</a>
          {commandTopics.includes(chapter.topic) && <a href={path("cytocausal")} aria-current={mode === "cytocausal" ? "page" : undefined}>Cytocausal</a>}
        </nav>
        <StandaloneDemo topic={chapter.topic} mode={mode} lang={lang} />
      </main>
    </div>
  </div>;
}
