import nextra from "nextra";

const withNextra = nextra({ defaultShowCopyCode: true, contentDirBasePath: "/", unstable_shouldAddLocaleToLinks: true });

export default withNextra({
  reactStrictMode: true,
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: { unoptimized: true },
  transpilePackages: ["@cytocausal/core", "@cytocausal/cytoscape", "@cytocausal/react"],
  trailingSlash: true,
  experimental: { globalNotFound: true },
  i18n: { locales: ["en", "zh-cn"], defaultLocale: "en" },
});
