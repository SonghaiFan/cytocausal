import nextra from "nextra";

const withNextra = nextra({ defaultShowCopyCode: true, contentDirBasePath: "/" });

export default withNextra({
  reactStrictMode: true,
  transpilePackages: ["@cytocausal/core", "@cytocausal/cytoscape", "@cytocausal/react"],
  trailingSlash: true,
  experimental: { globalNotFound: true },
  i18n: { locales: ["en", "zh-cn"], defaultLocale: "en" },
});
