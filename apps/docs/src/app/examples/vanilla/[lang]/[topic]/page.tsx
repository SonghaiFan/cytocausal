import { DemoPage } from "@/components/DemoPage";
import { VanillaFrame } from "@/components/VanillaFrame";
import { chapters, type Language } from "@/lib/chapters";

type Params = { params: Promise<{ lang: string; topic: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => chapters.map(({ topic }) => ({ topic }));

const titleOf = (topic: string, lang: string) => {
  const chapter = chapters.find((c) => c.topic === topic);
  return lang === "zh-cn" ? chapter?.zh : chapter?.title;
};

export async function generateMetadata({ params }: Params) {
  const { lang, topic } = await params;
  return { title: `${titleOf(topic, lang)} | cytocausal` };
}

export default async function VanillaDemo({ params }: Params) {
  const { lang, topic } = await params;
  return (
    <DemoPage topic={topic} mode="vanilla" lang={lang as Language}>
      <VanillaFrame src={`/demos/vanilla/${lang}/${topic}.html`} title={titleOf(topic, lang)!} />
    </DemoPage>
  );
}
