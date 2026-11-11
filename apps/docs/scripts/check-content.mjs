import { readFile, readdir, access } from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const languages = ['en', 'zh-cn'];
const pages = new Map();
for (const lang of languages) {
  const names = (await readdir(new URL(`src/content/${lang}/`, root))).filter(name => /\.mdx?$/.test(name));
  pages.set(lang, new Map(names.map(name => [name.replace(/\.mdx?$/, ''), name])));
}
assert.deepEqual([...pages.get('en').keys()].sort(), [...pages.get('zh-cn').keys()].sort(), 'Language page sets differ');
let count = 0;
for (const lang of languages) {
  const meta = await readFile(new URL(`src/content/${lang}/_meta.ts`, root), 'utf8');
  for (const [slug, name] of pages.get(lang)) {
    const file = `src/content/${lang}/${name}`;
    const text = await readFile(new URL(file, root), 'utf8');
    assert(text.startsWith('---\ntitle:'), `${file}: missing title`);
    assert(meta.includes(`"${slug}"`), `${file}: missing from _meta.ts`);
    for (const [, path] of text.matchAll(/\]\((\/[^)]+)\)/g)) {
      const [clean] = path.split('#');
      const [, destination, target = ''] = clean.split('/');
      if (languages.includes(destination)) {
        assert.equal(destination, lang, `${file}: link to the wrong language`);
        assert(pages.get(lang).has(target || 'index'), `${file}: unknown page ${path}`);
      } else {
        await access(new URL(`public${clean}`, root));
      }
    }
    count++;
  }
}
await import('./sync-examples.mjs');
console.log(`${count} pages verified, including local links, assets and language parity.`);
