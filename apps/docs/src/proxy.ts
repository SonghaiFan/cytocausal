// Page routes have no language in them, so this adds it from the language last visited.
// It also handles "/": redirecting that to /en/ elsewhere would reset a reader's language,
// because the logo links to it and Next.js prefetches that link.
export { proxy } from "nextra/locales";

export const config = {
  // Anything with a file extension is an asset
  matcher: ["/((?!api|_next|_pagefind|images|.*\\..*).*)"],
};
