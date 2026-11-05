import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
const chapters = JSON.parse((await readFile('src/lib/chapters.ts', 'utf8')).split('export const chapters = ')[1].split(' as const;')[0]);
let count = 0;
for (const lang of ['en', 'zh-cn']) {
  for (const c of chapters) {
    const file = `src/content/docs/${lang}/${c.topic}.md`;
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
console.log(`${count} tutorial/demo pairs and 7 React playgrounds verified.`);
