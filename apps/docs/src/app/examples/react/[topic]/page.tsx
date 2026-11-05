import { notFound } from "next/navigation";
import { DemoPage } from "@/components/DemoPage";
import { Playground } from "@/components/Playground";
import { chapters } from "@/lib/chapters";

export const dynamicParams = false;
export const generateStaticParams = () => chapters.map(({ topic }) => ({ topic }));

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  return { title: `${chapters.find((c) => c.topic === topic)?.zh} | cytocausal` };
}

export default async function ReactDemo({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!chapters.some((c) => c.topic === topic)) notFound();
  return (
    <DemoPage topic={topic} mode="react" lang="zh-cn">
      <div className="react-demo">
        <Playground topic={topic} />
      </div>
    </DemoPage>
  );
}
