// Environment overrides support local development; case apps default to their public domains.
export const appLinks = {
  studio: process.env.NEXT_PUBLIC_STUDIO_URL ?? "http://localhost:3103",
  perspectiva: process.env.NEXT_PUBLIC_PERSPECTIVA_URL ?? "https://perspectiva.songhai.site",
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://access.songhai.site",
};
