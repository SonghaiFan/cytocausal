// Run with the preview on port 3018: ego-browser nodejs < scripts/check-demo-ui.browser.js
const assert = (await import('node:assert/strict')).default;
const task = await taskSpace('Cytoscape UI regression');
const page = task.page('p1');
for (const lang of ['en', 'zh-cn']) {
  await page.goto(`http://127.0.0.1:3018/examples/vanilla/${lang}/setup/`);
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('canvas'));
  const graph = await page.evaluate(() => {
    const doc = document.querySelector('iframe').contentDocument;
    const cy = doc.querySelector('#cy')._cyreg.cy;
    return { nodes: cy.nodes().length, edges: cy.edges().length };
  });
  assert.equal(graph.nodes, 3, `${lang} setup must render starter nodes`);
  assert.equal(graph.edges, 2, `${lang} setup must connect the nodes`);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map(button => ({
    height: button.getBoundingClientRect().height, top: button.getBoundingClientRect().top, margin: getComputedStyle(button).marginTop,
  })));
  assert.equal(tabs[0].top, tabs[1].top, 'Preview and Code must align');
  assert.equal(tabs[0].height, tabs[1].height, 'Preview and Code must have equal height');
  assert.equal(tabs[1].margin, '0px', 'Markdown spacing must not affect tabs');
}
await page.goto('http://127.0.0.1:3018/examples/react/algorithms/');
await page.waitForSelector('canvas');
const controls = await page.evaluate(() => [...document.querySelectorAll('.react-demo button')].map(button => ({
  height: button.getBoundingClientRect().height, top: button.getBoundingClientRect().top,
  margin: getComputedStyle(button).marginTop, background: getComputedStyle(button).backgroundColor,
})));
assert.equal(new Set(controls.map(button => button.height)).size, 1, 'All demo buttons must use one height');
assert.equal(new Set(controls.map(button => button.background)).size, 1, 'All demo actions must use one button style');
assert.equal(controls[0].top, controls[1].top, 'Adjacent actions must align');
assert(controls.every(button => button.margin === '0px'), 'Markdown margins must not affect demo buttons');
await task.finish({ keep: [] });
console.log('PASS: setup graphs, aligned view tabs, and consistent demo buttons.');
