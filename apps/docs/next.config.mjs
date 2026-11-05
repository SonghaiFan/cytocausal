import nextra from "nextra";
import legacyRedirects from "./src/lib/legacy-redirects.json" with { type: "json" };

const withNextra = nextra({ defaultShowCopyCode: true, contentDirBasePath: "/" });

export default withNextra({
  reactStrictMode: true,
  trailingSlash: true,
  experimental: { globalNotFound: true },
  i18n: { locales: ["en", "zh-cn"], defaultLocale: "en" },
  redirects: async () =>
    [
      ["/", "/en/"],
      ["/docs", "/en/setup/"],
      ...Object.entries(legacyRedirects),
    ].map(([source, destination]) => ({
      source: encodeURI(source.replace(/\/$/, "") || "/"),
      destination,
      permanent: false,
    })),
});
