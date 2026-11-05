import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import legacyRedirects from './src/lib/legacy-redirects.json' with { type: 'json' };
export default defineConfig({
  integrations: [react(), starlight({
    title: 'Learning Cytoscape.js',
    defaultLocale: 'en',
    locales: { en: { label: 'English' }, 'zh-cn': { label: '简体中文', lang: 'zh-CN' } },
    sidebar: [{ autogenerate: { directory: '' } }],
    customCss: ['./src/styles/docs.css'],
    routeMiddleware: './src/middleware/demo-route.ts',
  })],
  vite: { plugins: [tailwindcss()] },
  redirects: { '/': '/en/', '/docs': '/en/setup/', ...legacyRedirects },
});
