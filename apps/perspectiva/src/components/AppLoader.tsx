"use client";
import dynamic from "next/dynamic";

// Cytoscape needs the DOM, so the app only renders in the browser
export const AppLoader = dynamic(
  () => import("@/components/PerspectivaApp").then((module) => module.PerspectivaApp),
  { ssr: false, loading: () => <div>Loading...</div> },
);
