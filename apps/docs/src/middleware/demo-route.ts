import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

/** Demo URLs intentionally live outside Starlight's locale-prefixed doc routes. */
export const onRequest = defineRouteMiddleware(context => {
  if (!context.url.pathname.startsWith('/examples/')) return;
  const route = context.locals.starlightRoute;
  const locale = context.url.pathname.includes('/vanilla/en/') ? 'en' : 'zh-cn';
  route.locale = locale;
  route.lang = locale === 'en' ? 'en' : 'zh-CN';
  route.entryMeta.locale = locale;
  route.entryMeta.lang = route.lang;
  route.siteTitleHref = `/${locale}/`;
  for (const item of route.sidebar) {
    if (item.type !== 'link') continue;
    item.href = item.href.replace(/^\/en(?=\/examples\/)/, '');
    item.isCurrent = item.href === context.url.pathname;
  }
});
