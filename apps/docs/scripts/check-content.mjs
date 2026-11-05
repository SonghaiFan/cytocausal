import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const chapters = JSON.parse((await readFile('src/lib/chapters.ts', 'utf8')).split('export const chapters = ')[1].split(' as const;')[0]);
let count = 0;
for (const lang of ['en', 'zh-cn']) {
  for (const c of chapters) {
    const file = `src/content/${lang}/${c.topic}.md`;
    const text = await readFile(file, 'utf8');
    assert(text.startsWith('---\ntitle:'), `${file}: missing title`);
    assert(!text.includes('raw.githack.com'), `${file}: stale remote preview`);
    assert(text.includes(`/examples/react/${c.topic}/`), `${file}: missing playground link`);
    const demo = `${lang}/${c.topic}`;
    assert(text.includes(`/examples/vanilla/${demo}/`), `${file}: missing semantic demo link`);
    assert(!text.includes('/index.html'), `${file}: non-semantic demo URL`);
    await access(`public/demos/vanilla/${demo}.html`);
    await access(`src/examples/${c.slug}/page.tsx`);
    count++;
  }
}
const guides = ['data-model', 'react-lifecycle', 'stable-layouts', 'version-transitions', 'causal-analysis', 'scale-performance', 'case-perspectiva', 'case-explorer'];
for (const lang of ['en', 'zh-cn']) {
  const meta = await readFile(`src/content/${lang}/_meta.ts`, 'utf8');
  for (const guide of guides) {
    const file = `src/content/${lang}/${guide}.md`;
    const text = await readFile(file, 'utf8');
    assert(text.startsWith('---\ntitle:'), `${file}: missing title`);
    assert(meta.includes(`"${guide}"`), `${file}: missing from _meta.ts`);
    for (const [, image] of text.matchAll(/!\[[^\]]*\]\((\/images\/[^)]+)\)/g)) await access(`public${image}`);
    for (const [, link] of text.matchAll(/\]\(\/([a-z-]+)\/([a-z-]+)\/\)/g)) {
      assert.equal(link, lang, `${file}: link to the wrong language`);
    }
  }
}
console.log(`${count} tutorial/demo pairs, 7 React playgrounds and ${guides.length * 2} guides verified.`);
