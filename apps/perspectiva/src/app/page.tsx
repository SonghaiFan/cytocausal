import { AppLoader } from "@/components/AppLoader";

type Search = { dataset?: string; debug?: string };

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const { dataset, debug } = await searchParams;
  return <AppLoader datasetId={dataset} debug={Boolean(debug)} />;
}
