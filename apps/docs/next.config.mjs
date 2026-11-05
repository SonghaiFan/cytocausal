import nextra from "nextra";
import legacyRedirects from "./src/lib/legacy-redirects.json" with { type: "json" };

const withNextra = nextra({ defaultShowCopyCode: true, contentDirBasePath: "/" });

export default withNextra({
  reactStrictMode: true,
  trailingSlash: true,
  experimental: { globalNotFound: true },
  i18n: { locales: ["en", "zh-cn"], defaultLocale: "en" },
  // "/" is left to the language proxy. Redirecting it to /en/ here would reset a reader's
  // language, because the logo links to it and Next.js prefetches that link.
  redirects: async () =>
    [
      ["/docs", "/en/setup/"],
      ...Object.entries(legacyRedirects),
    ].map(([source, destination]) => ({
      source: encodeURI(source.replace(/\/$/, "")),
      destination,
      permanent: false,
    })),
});
