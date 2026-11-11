// Set these when the example apps are deployed. The defaults are their development servers.
export const appLinks = {
  studio: process.env.NEXT_PUBLIC_STUDIO_URL ?? "http://localhost:3103",
  perspectiva: process.env.NEXT_PUBLIC_PERSPECTIVA_URL ?? "http://localhost:3100",
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "http://localhost:3101",
};
