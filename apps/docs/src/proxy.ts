// Page routes have no language in them, so this adds it from the language last visited.
export { proxy } from "nextra/locales";

export const config = {
  // Demos have their own URLs, and anything with a file extension is an asset
  matcher: ["/((?!api|_next|_pagefind|examples|demos|images|.*\\..*).*)"],
};
