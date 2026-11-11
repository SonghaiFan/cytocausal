import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";
import NextImage, { type ImageProps } from "next/image";
import { assetPath, basePath } from "./components/site-path.ts";
const themeComponents = getThemeComponents();
function Image(props: ImageProps) {
  const src = typeof props.src === "string" && props.src.startsWith("/") && !props.src.startsWith(`${basePath}/`)
    ? assetPath(props.src) : props.src;
  return <NextImage {...props} src={src} unoptimized />;
}
export function useMDXComponents(components?: Record<string, unknown>) {
  return { ...themeComponents, img: Image, ...components };
}
