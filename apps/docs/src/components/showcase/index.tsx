"use client";
import dynamic from "next/dynamic";

// Graphs need a browser, so these load after the page does.
const frame = (className: string) =>
  function Loading() {
    return <div className={className} />;
  };

export const WorkspaceDemo = dynamic(() => import("./demos.tsx").then((demos) => demos.WorkspaceDemo), {
  ssr: false,
  loading: frame("showcase-frame showcase-workspace"),
});
export const StyleDemo = dynamic(() => import("./demos.tsx").then((demos) => demos.StyleDemo), {
  ssr: false,
  loading: frame("showcase-frame showcase-style"),
});
export const CompareDemo = dynamic(() => import("./demos.tsx").then((demos) => demos.CompareDemo), {
  ssr: false,
  loading: frame("showcase-frame showcase-compare"),
});
export const GalleryDemo = dynamic(() => import("./demos.tsx").then((demos) => demos.GalleryDemo), {
  ssr: false,
  loading: frame("showcase-frame showcase-gallery"),
});
