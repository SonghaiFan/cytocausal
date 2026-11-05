import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';

const guides = ['getting-started', 'data-model', 'react-lifecycle', 'stable-layouts', 'version-transitions', 'causal-analysis', 'scale-performance', 'case-perspectiva', 'case-explorer'];

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
console.log(`${guides.length * 2} guides verified.`);
