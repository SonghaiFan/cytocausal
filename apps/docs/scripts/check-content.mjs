import { readFile, readdir, access } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const languages = ['en', 'zh-cn'];
const pages = new Map();
async function collectPages(lang, prefix = "") {
  const result = new Map();
  const entries = await readdir(new URL(`src/content/${lang}/${prefix}`, root), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const [slug, file] of await collectPages(lang, `${prefix}${entry.name}/`)) result.set(slug, file);
    } else if (/\.mdx?$/.test(entry.name)) {
      const file = `${prefix}${entry.name}`;
      const slug = file.replace(/\.mdx?$/, '').replace(/\/index$/, '');
      result.set(slug, file);
    }
  }
  return result;
}
for (const lang of languages) pages.set(lang, await collectPages(lang));
assert.deepEqual([...pages.get('en').keys()].sort(), [...pages.get('zh-cn').keys()].sort(), 'Language page sets differ');
let count = 0;
for (const lang of languages) {
  for (const [slug, name] of pages.get(lang)) {
    const file = `src/content/${lang}/${name}`;
    const text = await readFile(new URL(file, root), 'utf8');
    assert(text.startsWith('---\ntitle:'), `${file}: missing title`);
    const folder = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
    const key = name.split('/').at(-1).replace(/\.mdx?$/, '');
    const meta = await readFile(new URL(`src/content/${lang}/${folder}_meta.ts`, root), 'utf8');
    assert(meta.includes(`"${key}"`), `${file}: missing from _meta.ts`);
    for (const [, path] of text.matchAll(/\]\((\/[^)]+)\)/g)) {
      const [clean] = path.split('#');
      const [, destination, ...segments] = clean.split('/');
      const target = segments.filter(Boolean).join('/');
      if (languages.includes(destination)) {
        assert.equal(destination, lang, `${file}: link to the wrong language`);
        assert(pages.get(lang).has(target || 'index'), `${file}: unknown page ${path}`);
      } else if (destination === 'examples') {
        const [demoLang, mode, topic, ...rest] = segments.filter(Boolean);
        assert((mode !== 'cytocausal' || ['elements', 'events', 'data'].includes(topic)) && demoLang === lang && ['react', 'vanilla', 'cytocausal'].includes(mode) && ['setup', 'elements', 'layouts', 'styles', 'events', 'algorithms', 'data'].includes(topic) && rest.length === 0, `${file}: unknown demo ${path}`);
      } else {
        await access(new URL(`public${clean}`, root));
      }
    }
    count++;
  }
}
await import('./sync-examples.mjs');
console.log(`${count} pages verified, including local links, assets and language parity.`);
