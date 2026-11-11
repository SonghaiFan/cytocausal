import { test, expect, type Page } from "@playwright/test";
const fixture = { id: "Workshop", snapshots: [{ id: "draft", nodes: [
  { id: "a", label: "Demand", position: { x: 100, y: 160 }, evidence: [{ text: "Interview claim" }] },
  { id: "b", label: "Production", position: { x: 400, y: 160 } },
  { id: "c", label: "Capacity", position: { x: 250, y: 380 } },
], edges: [] }] };
async function seed(page: Page) {
  await page.addInitScript(data => { if (!localStorage.getItem("cytocausal-studio-v1")) localStorage.setItem("cytocausal-studio-v1", JSON.stringify(data)); }, fixture);
  await page.goto("/"); await settled(page);
}
async function settled(page: Page) { await expect(page.locator('.cc-layout-status')).toHaveCount(0); await expect(page.locator('canvas')).toHaveCount(3); }
async function state(page: Page) { return page.evaluate(() => {
  const cy = [...document.querySelectorAll<any>('div')].find(d => d._cyreg?.cy)?._cyreg.cy;
  return cy ? { nodes: cy.nodes().map((n: any) => ({ id: n.id(), label: n.data('label'), position: n.position() })), edges: cy.edges().map((e: any) => ({ id: e.id(), source: e.data('source'), target: e.data('target'), polarity: e.data('polarity') })), selection: cy.nodes('.focus').map((n: any) => n.id()), zoom: cy.zoom(), pan: cy.pan() } : null;
}); }
async function point(page: Page, id: string) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<any>('div')].find(d => d._cyreg?.cy)?._cyreg.cy.animated())).toBe(false);
  return page.evaluate(id => {
  const cy = [...document.querySelectorAll<any>('div')].find(d => d._cyreg?.cy)._cyreg.cy;
  const p = cy.getElementById(id).renderedPosition(); const box = cy.container().getBoundingClientRect(); return {x:p.x+box.left,y:p.y+box.top};
}, id); }
async function clickNode(page: Page, id: string, button: 'left'|'right' = 'left') { const p = await point(page,id); await page.mouse.click(p.x,p.y,{button}); }
async function radial(page: Page, id: string, action: string) { await clickNode(page,id,'right'); await expect(page.getByRole('menu')).toBeVisible(); await page.getByRole('menuitem',{name:action,exact:false}).click(); }
async function blank(page: Page) { const box = await page.getByRole('region',{name:'Drawing canvas'}).boundingBox(); return { x: box!.x + box!.width * .72, y: box!.y + box!.height - 150 }; }

test('radial connects existing nodes, quick polarity and undo/redo keep direction', async ({page}) => {
  await seed(page); await radial(page,'a','Add effect'); await clickNode(page,'b');
  await expect.poll(async()=> (await state(page))?.edges.map((e:any)=>[e.source,e.target])).toEqual([['a','b']]);
  await page.locator('.quick-polarity').getByRole('button',{name:'+ Positive'}).click();
  await expect.poll(async()=> (await state(page))?.edges[0]?.polarity).toBe('positive');
  await page.getByRole('button',{name:'Undo',exact:true}).click(); await expect.poll(async()=> (await state(page))?.edges[0]?.polarity).not.toBe('positive');
  await page.getByRole('button',{name:'Undo',exact:true}).click(); await expect.poll(async()=> (await state(page))?.edges.length).toBe(0);
  await page.getByRole('button',{name:'Redo',exact:true}).click(); await expect.poll(async()=> (await state(page))?.edges.length).toBe(1);
  await page.getByRole('button',{name:'Redo',exact:true}).click(); await expect.poll(async()=> (await state(page))?.edges[0]?.polarity).toBe('positive');
});

test('Add cause creates a named endpoint and link as one undo step; Escape leaves no orphan', async ({page}) => {
  await seed(page); await radial(page,'a','Add cause'); const p=await blank(page); await page.mouse.click(p.x,p.y);
  await page.getByRole('textbox',{name:'Variable name'}).fill('Income'); await expect(page.locator('.connection-preview line')).toHaveCount(1); await page.keyboard.press('Enter');
  await expect.poll(async()=> (await state(page))?.nodes.length).toBe(4);
  const s=await state(page); const income=s!.nodes.find((n:any)=>n.label==='Income'); expect(s!.edges[0]).toMatchObject({source:income.id,target:'a'});
  await page.getByRole('button',{name:'Undo',exact:true}).click(); await expect.poll(async()=> [(await state(page))?.nodes.length,(await state(page))?.edges.length]).toEqual([3,0]);
  await page.getByRole('button',{name:'Redo',exact:true}).click(); await expect.poll(async()=> (await state(page))?.nodes.length).toBe(4);
  await radial(page,'b','Add effect'); const q=await blank(page); await page.mouse.click(q.x-100,q.y); await page.getByRole('textbox',{name:'Variable name'}).fill('Cancelled'); await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox',{name:'Variable name'})).toHaveCount(0); expect((await state(page))!.nodes.length).toBe(4);
});

test('inline rename is one edit, keyboard menu works and viewport survives Author/Explore', async ({page}) => {
  const errors:string[]=[];page.on('pageerror', e=>errors.push(e.message));
  await seed(page); const p=await point(page,'a'); await page.mouse.dblclick(p.x,p.y);
  await expect(page.getByRole('menu',{name:'Actions for Demand'})).toBeVisible(); await page.getByRole('menuitem',{name:'Rename'}).click();
  await page.getByRole('textbox',{name:'Variable name'}).fill('Customer demand'); await page.keyboard.press('Enter');
  await expect.poll(async()=> (await state(page))?.nodes.find((n:any)=>n.id==='a')?.label).toBe('Customer demand');
  await page.keyboard.press('ControlOrMeta+z'); await expect.poll(async()=> (await state(page))?.nodes.find((n:any)=>n.id==='a')?.label).toBe('Demand');
  // The graph applies an edit a couple of frames later, so wait for the label before trusting that it has settled
  await page.getByRole('button',{name:'Redo',exact:true}).click(); await expect.poll(async()=> (await state(page))?.nodes.find((n:any)=>n.id==='a')?.label).toBe('Customer demand'); await settled(page);
  await expect.poll(async()=> (await state(page))?.selection).toEqual(['a']);
  await expect(page.getByRole('heading',{name:'Customer demand',exact:true})).toBeVisible();
  await page.locator('[aria-label="Causal graph"]').focus(); await page.keyboard.press('Shift+F10'); await expect(page.getByRole('menu')).toBeVisible(); await page.keyboard.press('Escape');
  await page.evaluate(()=> { const cy=[...document.querySelectorAll<any>('div')].find(d=>d._cyreg?.cy)._cyreg.cy; cy.viewport({zoom:1.1,pan:{x:75,y:40}}); (window as any).originalCy=cy; });
  const before=await state(page);
  await page.getByRole('button',{name:'Explore',exact:true}).click(); await expect(page.getByRole('heading',{name:'Explore your graph'})).toBeVisible();
  let after=await state(page); expect(after!.pan).toEqual(before!.pan); expect(after!.zoom).toBe(before!.zoom); expect(after!.selection).toEqual(before!.selection);
  await clickNode(page,'b'); const explored=await state(page);
  await page.getByRole('button',{name:'Author',exact:true}).click(); after=await state(page); expect(after!.selection).toEqual(explored!.selection);expect(after!.pan).toEqual(explored!.pan);expect(after!.zoom).toBe(explored!.zoom);
  expect(await page.evaluate(()=> (window as any).originalCy===[...document.querySelectorAll<any>('div')].find(d=>d._cyreg?.cy)._cyreg.cy)).toBe(true);
  expect(errors).toEqual([]);
});

test('node movement is undoable; exploration movement is temporary', async ({page}) => {
  await seed(page);const before=await state(page);const p=await point(page,'a');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+65,p.y+30,{steps:8});await page.mouse.up();
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled(); await settled(page);
  const moved=(await state(page))!.nodes.find((n:any)=>n.id==='a').position;
  expect(moved).not.toEqual(before!.nodes[0].position);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=> (await state(page))?.nodes.find((n:any)=>n.id==='a').position).toEqual(before!.nodes[0].position);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled(page);await page.getByRole('button',{name:'Explore',exact:true}).click();
  const q=await point(page,'a');await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q.x+40,q.y+20,{steps:8});await page.mouse.up();
  await page.getByRole('button',{name:'Author',exact:true}).click();await expect.poll(async()=> (await state(page))?.nodes.find((n:any)=>n.id==='a').position).toEqual(moved);
});

test('save, reload, export evidence, invalid import, deletion and mobile menu', async ({page}) => {
  await seed(page);await radial(page,'a','Add effect');await clickNode(page,'b');await expect(page.locator('.save-status')).toHaveText('Saved in this browser.');
  await page.reload();await expect.poll(async()=> (await state(page))?.edges.length).toBe(1);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const file=await download;const stream=await file.createReadStream();const chunks=[];for await(const chunk of stream!) chunks.push(chunk);const data=JSON.parse(Buffer.concat(chunks).toString());expect(data.snapshots[0].nodes[0].evidence[0].text).toBe('Interview claim');
  await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"snapshots":[]}')});await expect(page.locator('.studio-error')).toContainText('dataset needs');expect((await state(page))!.nodes.length).toBe(3);
  await clickNode(page,'a');await page.getByRole('button',{name:'Delete node and its links',exact:true}).click();await expect.poll(async()=> [(await state(page))?.nodes.length,(await state(page))?.edges.length]).toEqual([2,0]);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=> (await state(page))?.nodes.length).toBe(3);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Fit graph',exact:true}).click();await radial(page,'b','Rename');await expect(page.getByRole('textbox',{name:'Variable name'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('empty canvas creation and cancellation work without a sidebar form', async ({page}) => {
  await page.goto('/');await settled(page);await page.locator('.empty-canvas').getByRole('button',{name:'Add variable'}).click();await page.getByRole('textbox',{name:'Variable name'}).fill('Demand');await page.keyboard.press('Enter');await expect.poll(async()=> (await state(page))?.nodes.length).toBe(1);
  await expect(page.locator('.gesture-hint')).toHaveText('Hold to exploreDouble-click to add');await expect(page.locator('.node-add, button:has-text("Add relationship")')).toHaveCount(0);
  const node=(await state(page))!.nodes[0].id;const at=await point(page,node);await page.mouse.dblclick(at.x,at.y);await expect(page.getByRole('menu')).toBeVisible();await expect(page.locator('.gesture-hint')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);
});

test('holding a node opens the traversal fan in both modes; right-click opens the edit ring', async ({page}) => {
  await seed(page); await radial(page,'a','Add effect'); await clickNode(page,'b'); await settled(page); await page.locator('.quick-polarity').getByRole('button',{name:'Close polarity editor'}).click();
  for (const mode of ['Author','Explore']) {
    await page.getByRole('button',{name:mode,exact:true}).click();
    const p=await point(page,'a'); await page.mouse.move(p.x,p.y); await page.mouse.down();
    await expect(page.locator('.cc-marking-halo[data-target="b"]')).toBeVisible(); await expect(page.getByRole('menu',{name:'Actions for Demand'})).toHaveCount(0);
    await page.mouse.up(); await expect(page.locator('.cc-marking-halo[data-target="b"]')).toBeVisible();
    // Walking the fan moves the selection and edits nothing
    const b=await point(page,'b'); await page.mouse.move((p.x+b.x)/2,(p.y+b.y)/2,{steps:4}); await page.mouse.click((p.x+b.x)/2,(p.y+b.y)/2);
    await expect(page.locator('.cc-marking-center[data-node="b"]')).toHaveCount(1);
    await page.keyboard.press('Escape'); await expect(page.locator('.cc-radial')).toHaveCount(0);
    // The walk stays lit after the fan closes
    await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll<any>('div')].find(d=>d._cyreg?.cy)._cyreg.cy.getElementById('b').hasClass('route-node'))).toBe(true);
    expect((await state(page))!.edges).toHaveLength(1); expect((await state(page))!.nodes).toHaveLength(3);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Author',exact:true}).click(); await clickNode(page,'a','right');
  await expect(page.getByRole('menu',{name:'Actions for Demand'})).toBeVisible(); await expect(page.locator('.cc-radial')).toHaveCount(0);
  await page.keyboard.press('Escape'); await page.getByRole('button',{name:'Explore',exact:true}).click(); await clickNode(page,'a','right'); await expect(page.locator('.cc-radial')).toBeVisible();
  const before=await state(page);await page.getByRole('button',{name:'Author',exact:true}).click();await expect(page.locator('.cc-radial')).toHaveCount(0);expect((await state(page))!.selection).toEqual(before!.selection);
});

test('both modes expose a relationship menu without losing selection or editing the graph', async ({page}) => {
  await seed(page);
  await radial(page,'a','Add effect'); await clickNode(page,'b'); await settled(page);
  const a=await point(page,'a'); await page.mouse.dblclick(a.x,a.y);
  await expect(page.getByRole('menu',{name:'Actions for Demand'})).toBeVisible();
  await page.keyboard.press('Escape');
  const before = await state(page);
  await page.getByRole('button',{name:'Explore',exact:true}).click();
  await expect(page.locator('.gesture-hint')).toHaveText('Hold to exploreRight-click for links');
  await clickNode(page,'a','right');
  await expect(page.locator('.cc-radial')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cc-radial')).toHaveCount(0);
  expect((await state(page))?.selection).toEqual(before?.selection);
  await page.getByRole('button',{name:'Author',exact:true}).click();
  await expect(page.locator('.gesture-hint')).toHaveText('Hold to exploreDouble-click to add');
  expect(await state(page)).toEqual(before);
});

test('one ring in both modes: the yellow node stays the hub, sectors turn ink, additions are solid blue', async ({page}) => {
  await seed(page); await radial(page,'a','Add effect');
  const q=await point(page,'b'); await page.mouse.move(q.x,q.y-90);
  const preview=page.locator('.connection-preview line');
  await expect(preview).toHaveCSS('stroke','rgb(31, 111, 214)'); await expect(preview).toHaveCSS('stroke-dasharray','none');
  await clickNode(page,'b'); await settled(page);
  await clickNode(page,'a','right');
  const hub=await point(page,'a');
  // The ring is centred on its node and leaves it uncovered
  const ring=await page.getByRole('menu',{name:'Actions for Demand'}).boundingBox();
  expect(Math.abs(ring!.x+ring!.width/2-hub.x)).toBeLessThan(1.5); expect(Math.abs(ring!.y+ring!.height/2-hub.y)).toBeLessThan(1.5);
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,hub)).toBe('CANVAS');
  expect((await state(page))!.selection).toEqual(['a']);
  await expect(page.getByRole('menuitem')).toHaveCount(4);
  await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('menuitem',{name:/Add cause/})).toBeFocused();
  await expect(page.getByRole('menuitem',{name:/Add cause/})).toHaveCSS('fill-opacity','1');
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('menuitem',{name:'Delete node and its links'})).toHaveCSS('fill','rgb(200, 64, 12)');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Explore',exact:true}).click(); await clickNode(page,'a','right');
  const sector=page.locator('.cc-radial-sector[data-target="b"]');
  await expect(sector).toHaveCount(1); await expect(sector).toHaveAttribute('data-direction','effect'); await expect(sector).toHaveCSS('fill-opacity','0.14');
  const b=await point(page,'b'); await page.mouse.move((hub.x+b.x)/2,(hub.y+b.y)/2+30);
  await expect(sector).toHaveAttribute('data-active','true'); await expect(sector).toHaveCSS('fill-opacity','1');
});

test('dragging out of a sector places the other end; a name typed in place survives clicking away', async ({page}) => {
  await seed(page); await clickNode(page,'a','right');
  // Onto empty canvas: a new variable is named where the drag ended, already linked
  let box=await page.getByRole('menuitem',{name:/Add effect/}).boundingBox(); const drop=await blank(page);
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2); await page.mouse.down(); await page.mouse.move(drop.x,drop.y,{steps:6});
  await expect(page.locator('.connection-preview line')).toHaveCount(1); await page.mouse.up();
  const name=page.getByRole('textbox',{name:'Variable name'}); await expect(name).toBeFocused();
  const ghost=await page.locator('.ghost-pill').boundingBox(); expect(Math.abs(ghost!.x+ghost!.width/2-drop.x)).toBeLessThan(2); expect(Math.abs(ghost!.y+ghost!.height/2-drop.y)).toBeLessThan(2);
  await name.fill('Orders'); await page.getByRole('textbox',{name:'Graph name'}).click();
  await expect.poll(async()=> (await state(page))?.nodes.length).toBe(4);
  let s=await state(page); const orders=s!.nodes.find((n:any)=>n.label==='Orders'); expect(s!.edges).toHaveLength(1); expect(s!.edges[0]).toMatchObject({source:'a',target:orders.id}); expect(s!.selection).toEqual([orders.id]);
  await page.getByRole('button',{name:'Undo',exact:true}).click(); await expect.poll(async()=> [(await state(page))?.nodes.length,(await state(page))?.edges.length]).toEqual([3,0]); await settled(page);
  // Onto a variable: it becomes the cause
  await clickNode(page,'a','right'); box=await page.getByRole('menuitem',{name:/Add cause/}).boundingBox(); const c=await point(page,'c');
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2); await page.mouse.down(); await page.mouse.move(c.x,c.y,{steps:6}); await page.mouse.up();
  await expect.poll(async()=> (await state(page))?.edges.map((e:any)=>[e.source,e.target])).toEqual([['c','a']]);
  // An empty name leaves nothing behind
  const p=await blank(page); await page.mouse.dblclick(p.x,p.y); await expect(name).toBeFocused(); await page.getByRole('textbox',{name:'Graph name'}).click();
  await expect(name).toHaveCount(0); expect((await state(page))!.nodes.length).toBe(3);
});

test('right-click on empty canvas adds nothing; node style switches in place and the ghost follows it', async ({page}) => {
  await seed(page); const p=await blank(page); await page.mouse.click(p.x,p.y,{button:'right'});
  await expect(page.getByRole('textbox',{name:'Variable name'})).toHaveCount(0);
  const before=await state(page);
  await page.getByRole('button',{name:'Text by dot',exact:true}).click(); await settled(page);
  await expect.poll(()=>page.evaluate(()=>{const cy=[...document.querySelectorAll<any>('div')].find(d=>d._cyreg?.cy)._cyreg.cy; return cy.getElementById('a').style('shape');})).toBe('ellipse');
  const after=await state(page); expect(after!.nodes).toEqual(before!.nodes); expect(after!.pan).toEqual(before!.pan);
  // The ring goes around the dot and its name
  await clickNode(page,'a','right'); const ring=await page.getByRole('menu',{name:'Actions for Demand'}).boundingBox(); const hub=await point(page,'a');
  expect(Math.abs(ring!.x+ring!.width/2-hub.x)).toBeLessThan(1.5); expect(ring!.width).toBeGreaterThan(90); await page.keyboard.press('Escape');
  await page.mouse.dblclick(p.x,p.y); const dot=await page.locator('.ghost-dot').boundingBox();
  expect(Math.abs(dot!.x+dot!.width/2-p.x)).toBeLessThan(2); expect(Math.abs(dot!.y+dot!.height/2-p.y)).toBeLessThan(2);
  await page.getByRole('textbox',{name:'Variable name'}).fill('Orders'); await page.keyboard.press('Enter');
  await expect.poll(async()=> (await state(page))?.nodes.length).toBe(4);
  await page.reload(); await settled(page); await expect(page.getByRole('button',{name:'Text by dot',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('Explore has no reach ring: steps are a sidebar setting, and the ring clears a label beside a dot', async ({page}) => {
  await seed(page); await radial(page,'a','Add effect'); await clickNode(page,'b'); await settled(page);
  await page.getByRole('button',{name:'Text by dot',exact:true}).click(); await page.getByRole('button',{name:'Explore',exact:true}).click();
  await clickNode(page,'a','right'); await expect(page.locator('.cc-radial-sector[data-target="b"]')).toBeVisible();
  await expect(page.locator('.cc-radial-step')).toHaveCount(0);
  // Every sector starts outside the node's label
  const clear=await page.evaluate(()=>{ const cy=[...document.querySelectorAll<any>('div')].find(d=>d._cyreg?.cy)._cyreg.cy; const n=cy.getElementById('a'); const p=n.renderedPosition(); const b=n.renderedBoundingBox({includeLabels:true,includeOverlays:false});
    const label=Math.max(p.x-b.x1,b.x2-p.x,p.y-b.y1,b.y2-p.y);
    // Sector paths are drawn about the node's centre, so the nearest point of each is its distance from the node
    const nearest=Math.min(...[...document.querySelectorAll<SVGPathElement>('.cc-radial-sector')].flatMap(path=>Array.from({length:60},(_,k)=>{const q=path.getPointAtLength(path.getTotalLength()*k/60);return Math.hypot(q.x,q.y);})));
    return nearest>label; });
  expect(clear).toBe(true);
  const steps=page.getByRole('radiogroup',{name:'Steps shown'}).or(page.getByRole('group',{name:'Steps shown'}));
  await expect(steps).toBeVisible();
});

test('an interrupted sector drag cancels cleanly without creating a relationship', async ({page}) => {
  await seed(page); await clickNode(page,'a','right');
  const box = await page.getByRole('menuitem',{name:/Add effect/}).boundingBox();
  const drop = await blank(page);
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down(); await page.mouse.move(drop.x,drop.y,{steps:6});
  await expect(page.locator('.connection-preview')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await expect(page.locator('.connection-hint')).toHaveCount(0);
  await page.mouse.up(); await page.mouse.move(drop.x-30,drop.y-30);
  await expect(page.locator('.connection-preview')).toHaveCount(0);
  await expect(page.getByRole('textbox',{name:'Variable name'})).toHaveCount(0);
  expect((await state(page))?.edges).toHaveLength(0);
  expect((await state(page))?.nodes).toHaveLength(3);
});
