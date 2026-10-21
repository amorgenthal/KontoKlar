import {chromium} from 'playwright';
import PDFLib from 'pdf-lib';
const {PDFDocument}=PDFLib;
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
await fs.mkdir('tests/output',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await context.addInitScript(()=>{
  window.testExports=[];let pending;
  window.KontoKlarNative={
    beginExport(name,type){pending={name,type,chunks:[]};return true;},
    appendChunk(data){pending.chunks.push(data);return true;},
    finishExport(){window.testExports.push(pending);pending=null;return true;},
    abortExport(){pending=null;}
  };
});
const page=await context.newPage();const errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4174\/|blob:|data:)/.test(r.url()))external.push(r.url());});
try{
  await page.goto('http://127.0.0.1:4174');
  assert.equal(await page.locator('body').getAttribute('data-tab'),'documents');
  await page.locator('#demo').tap();assert.equal(await page.locator('body').getAttribute('data-tab'),'edit');
  assert.ok(await page.locator('[data-mode="move"]').evaluate(e=>e.classList.contains('active')));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No horizontal overflow on phone');
  await page.locator('#find').tap();await page.waitForFunction(()=>document.body.dataset.tab==='review');
  assert.equal(await page.locator('.suggestion').count(),2);
  await page.locator('.suggestion button').first().tap();assert.equal(await page.locator('body').getAttribute('data-tab'),'edit');
  await page.locator('[data-tab-target="review"]').tap();await page.locator('.suggestion button').nth(1).tap();
  await page.locator('[data-tab-target="review"]').tap();await page.locator('#mobile-preview').tap();
  assert.equal(await page.locator('body').getAttribute('data-tab'),'edit');
  await page.locator('[data-tab-target="review"]').tap();await page.locator('#reviewed').check();
  await page.locator('#export-pdf').tap();
  await page.waitForFunction(()=>window.testExports.length===1);
  let file=await page.evaluate(()=>window.testExports[0]);
  const bytes=Buffer.concat(file.chunks.map(c=>Buffer.from(c,'base64')));await fs.writeFile('tests/output/Android-Nachweis.pdf',bytes);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);assert.equal(file.type,'application/pdf');
  await page.locator('#export-png').tap();await page.waitForFunction(()=>window.testExports.length===2);
  file=await page.evaluate(()=>window.testExports[1]);await fs.writeFile('tests/output/Android-Nachweis.png',Buffer.concat(file.chunks.map(c=>Buffer.from(c,'base64'))));
  assert.equal(file.type,'image/png');
  await page.screenshot({path:'tests/output/Android-Export.png',fullPage:true});
  // Import actual multipage PDF, use native text + OCR, and retain all pages.
  await page.locator('#files').setInputFiles('demo/Beispiel-mehrseitig.pdf');
  await page.waitForFunction(()=>!document.getElementById('find').disabled && document.querySelectorAll('.page-item').length===3);
  assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false,await page.locator('#status').textContent());
  assert.match(await page.locator('#status').textContent(),/2 Seite\(n\) geladen/);
  assert.equal(await page.locator('body').getAttribute('data-tab'),'edit');
  await page.locator('#find').tap();await page.waitForFunction(()=>!document.getElementById('find').disabled && document.body.dataset.tab==='review',{},{timeout:120000});
  assert.equal(await page.locator('.suggestion').count(),1);
  await page.locator('[data-tab-target="documents"]').tap();await page.locator('.page-item').nth(2).tap();
  await page.locator('[data-tab-target="review"]').tap();assert.equal(await page.locator('.suggestion').count(),2,'Offline OCR works in mobile layout');
  await page.locator('#export-scope').selectOption('all');await page.locator('#export-pdf').tap();await page.waitForFunction(()=>window.testExports.length===3);
  file=await page.evaluate(()=>window.testExports[2]);const all=Buffer.concat(file.chunks.map(c=>Buffer.from(c,'base64')));await fs.writeFile('tests/output/Android-alle-Seiten.pdf',all);
  assert.equal((await PDFDocument.load(all)).getPageCount(),3);
  // Touch marking at 200% zoom; navigation mode keeps scrolling available.
  await page.locator('[data-tab-target="edit"]').tap();await page.locator('#mobile-zoom').selectOption('2');
  await page.locator('#preview').uncheck();await page.locator('[data-mode="keep"]').tap();
  await page.locator('#stage').evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});await page.locator('#stage').scrollIntoViewIfNeeded();
  const box=await page.locator('#view').boundingBox();const session=await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+20,y:box.y+25}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+170,y:box.y+100}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('.mark:not(.area):not(.hide)').count(),1);
  await page.locator('[data-tab-target="review"]').tap();assert.ok(await page.locator('#export-pdf').isDisabled(),'Unreviewed touch marking blocks all-page export');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: phone layout, tabs, offline PDF/OCR, native export adapter, PNG/PDF bytes, all/hit page scopes, touch marking at 200% zoom, review gate.');
}finally{await context.close();await browser.close();}
