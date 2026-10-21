import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
await fs.mkdir('tests/output',{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1500,height:1050},acceptDownloads:true});
const page=await context.newPage();const errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4173\/|blob:|data:)/.test(r.url()))external.push(r.url());});
page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text());});
try{
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#demo').click();await page.locator('#find').click();
  await page.waitForFunction(()=>document.querySelectorAll('.suggestion').length===2);
  assert.equal(await page.locator('.suggestion').count(),2);
  const img=await page.locator('#view').evaluate(c=>c.toDataURL('image/png').split(',')[1]);
  await fs.writeFile('demo/Beispiel-Kontoauszug.png',Buffer.from(img,'base64'));
  await page.locator('.suggestion button').nth(0).click();await page.locator('.suggestion button').nth(1).click();
  assert.ok(await page.locator('#export-pdf').isDisabled());
  await page.locator('#preview').check();await page.locator('#reviewed').check();
  assert.ok(await page.locator('#export-pdf').isEnabled());
  await page.screenshot({path:'tests/output/vorschau.png',fullPage:true});
  const get=page.waitForEvent('download');await page.locator('#export-pdf').click();const pdfDownload=await get;await pdfDownload.saveAs('tests/output/Nachweise.pdf');
  const getPng=page.waitForEvent('download');await page.locator('#export-png').click();await (await getPng).saveAs('tests/output/Nachweis.png');
  const privacy=await page.evaluate(async()=>{
    const {sanitizedCanvas}=await import('./core.mjs');
    const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,100,100);
    const clean=sanitizedCanvas({canvas,width:100,height:100,keeps:[{x:20,y:20,w:50,h:50}],hides:[{x:30,y:30,w:10,h:10}]});
    const c=clean.getContext('2d');return {black:[...c.getImageData(0,0,1,1).data],keep:[...c.getImageData(25,25,1,1).data],override:[...c.getImageData(35,35,1,1).data]};
  });
  assert.deepEqual(privacy.black,[0,0,0,255]);assert.deepEqual(privacy.keep,[255,255,255,255]);assert.deepEqual(privacy.override,[0,0,0,255]);
  // Any edit invalidates prior review and therefore closes the export gate.
  await page.locator('#selection-list .selected-line button').first().click();assert.ok(await page.locator('#export-pdf').isDisabled());
  await page.locator('#undo').click();assert.ok(await page.locator('#export-pdf').isDisabled());
  // Native-text PDF + raster scan in one document exercise both import paths.
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  const pdfPage=doc.addPage([620,877]);
  for(const [text,y] of [['Kontoauszug Beispiel',800],['01.10.2026 Supermarkt -42,50 EUR',700],['04.10.2026 Anna Beispiel -350,00 EUR',600],['Unterstuetzung Oktober',580],['08.10.2026 Andere Person -20,00 EUR',500]])pdfPage.drawText(text,{x:40,y,size:13,font});
  const embedded=await doc.embedPng(Buffer.from(img,'base64')),scan=doc.addPage([620,877]);scan.drawImage(embedded,{x:0,y:0,width:620,height:877});
  await fs.writeFile('demo/Beispiel-mehrseitig.pdf',await doc.save());
  await page.locator('#files').setInputFiles('demo/Beispiel-mehrseitig.pdf');
  await page.waitForFunction(()=>document.querySelectorAll('.page-item').length===3 && !document.getElementById('find').disabled,{},{timeout:30000});
  assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false,await page.locator('#status').textContent());
  assert.match(await page.locator('#status').textContent(),/2 Seite\(n\) geladen/);
  await page.locator('#find').click();await page.waitForFunction(()=>document.querySelectorAll('.suggestion').length===1);
  assert.match(await page.locator('.suggestion pre').textContent(),/Unterstuetzung/);
  await page.locator('.page-item').nth(2).click();
  await page.locator('#find').click();
  await page.waitForFunction(()=>!document.getElementById('find').disabled,{},{timeout:120000});
  console.log('OCR result:',await page.locator('#status').textContent());
  assert.equal(await page.locator('.suggestion').count(),2,'OCR finds both Anna bookings in scan');
  await page.screenshot({path:'tests/output/suche.png',fullPage:true});
  // Image import uses the same local OCR, independently of the demo text layer.
  await page.locator('#files').setInputFiles('demo/Beispiel-Kontoauszug.png');
  await page.waitForFunction(()=>document.querySelectorAll('.page-item').length===4 && !document.getElementById('find').disabled);
  await page.locator('#find').click();await page.waitForFunction(()=>!document.getElementById('find').disabled,{},{timeout:120000});
  assert.equal(await page.locator('.suggestion').count(),2);
  const bytes=await fs.readFile('tests/output/Nachweise.pdf');
  const text=await page.evaluate(async arr=>{const pdfjs=await import('./vendor/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(arr)}).promise;const items=(await (await pdf.getPage(1)).getTextContent()).items;return {pages:pdf.numPages,text:items.map(i=>i.str).join('')};},[...bytes]);
  assert.equal(text.pages,1);assert.equal(text.text,'','Export has no hidden text layer');
  // Exercise actual pointer-based manual marking, including hide priority.
  await page.locator('.page-item').first().click();
  const rect=await page.locator('#view').boundingBox();
  const drag=async(x1,y1,x2,y2)=>{await page.mouse.move(x1,y1);await page.mouse.down();await page.mouse.move(x2,y2,{steps:6});await page.mouse.up();};
  await drag(rect.x+30,rect.y+25,rect.x+300,rect.y+100);
  assert.equal(await page.locator('.mark:not(.hide):not(.area)').count(),3);
  await page.locator('[data-mode="hide"]').click();
  await drag(rect.x+80,rect.y+40,rect.x+160,rect.y+70);
  assert.equal(await page.locator('.mark.hide').count(),1);
  await page.locator('#preview').check();await page.locator('#reviewed').check();
  // A second reviewed page is included in a multi-page export.
  await page.locator('.page-item').nth(2).click();await page.locator('.suggestion button').first().click();
  await page.locator('#preview').check();await page.locator('#reviewed').check();
  const multi=page.waitForEvent('download');await page.locator('#export-pdf').click();await (await multi).saveAs('tests/output/Nachweise-mehrseitig.pdf');
  const multiDoc=await PDFDocument.load(await fs.readFile('tests/output/Nachweise-mehrseitig.pdf'));assert.equal(multiDoc.getPageCount(),2);
  // All-page mode preserves the full order, including completely black pages.
  await page.locator('#export-scope').selectOption('all');
  assert.match(await page.locator('#review-count').textContent(),/4 Seiten im PDF · 2 vollständig geschwärzt/);
  assert.ok(await page.locator('#export-pdf').isEnabled());
  const allDownload=page.waitForEvent('download');await page.locator('#export-pdf').click();await (await allDownload).saveAs('tests/output/Nachweise-alle-Seiten.pdf');
  const allBytes=await fs.readFile('tests/output/Nachweise-alle-Seiten.pdf');
  const retained=await page.evaluate(async arr=>{
    const pdfjs=await import('./vendor/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(arr)}).promise;const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      const p=await pdf.getPage(n),vp=p.getViewport({scale:0.3});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);
      const ctx=c.getContext('2d');await p.render({canvasContext:ctx,viewport:vp,background:'#000000'}).promise;
      const pixels=ctx.getImageData(0,0,c.width,c.height).data;
      let allBlack=true;for(let i=0;i<pixels.length;i+=4)if(pixels[i] || pixels[i+1] || pixels[i+2]){allBlack=false;break;}
      pages.push({black:allBlack,text:(await p.getTextContent()).items.map(i=>i.str).join('')});
    }return pages;
  },[...allBytes]);
  assert.equal(retained.length,4);assert.deepEqual(retained.map(p=>p.black),[false,true,false,true]);
  assert.ok(retained.every(p=>p.text===''),'All-page export also contains no hidden text');
  // Adding an unreviewed visible region must block the ALL-page export.
  await page.locator('.page-item').nth(1).click();await page.locator('.suggestion button').first().click();
  assert.ok(await page.locator('#export-pdf').isDisabled());
  assert.match(await page.locator('#review-count').textContent(),/1 mit Freigaben noch zu prüfen/);
  await page.locator('#export-scope').selectOption('hits');assert.ok(await page.locator('#export-pdf').isEnabled());
  await page.locator('#export-scope').selectOption('all');assert.ok(await page.locator('#export-pdf').isDisabled());
  await page.locator('#preview').check();await page.locator('#reviewed').check();assert.ok(await page.locator('#export-pdf').isEnabled());
  await page.screenshot({path:'tests/output/seitenauswahl.png',fullPage:true});
  assert.deepEqual(external,[],'No outgoing document or asset requests');assert.deepEqual(errors,[]);
  console.log('PASS: demo, raster privacy, edit review gate, both PDF page scopes, retained black pages, PNG export, multipage PDF text/scan import, image OCR, local-only requests.');
}finally{await context.close();await browser.close();}
