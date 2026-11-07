// Regression: a long PDF must not paint over the sidebar action buttons.
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

await fs.mkdir('tests/output', {recursive:true});
const doc=await PDFDocument.create();
for(let n=1;n<=40;n++){
  const p=doc.addPage([120,160]);
  p.drawText('Testseite '+n,{x:10,y:130,size:10});
}
const pdf=Buffer.from(await doc.save());
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  for(const viewport of [
    {width:1450,height:900},
    {width:1100,height:700},
    {width:980,height:620},
  ]){
    await page.setViewportSize(viewport);
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#files').setInputFiles({
      name:'Viele-Seiten.pdf',mimeType:'application/pdf',buffer:pdf,
    });
    await page.waitForFunction(()=>document.querySelectorAll('.page-item').length===40 &&
      !document.querySelector('#clear').disabled, {}, {timeout:60000});
    assert.equal(await page.locator('#status.error').count(),0);
    const geometry=await page.evaluate(()=>{
      const list=document.querySelector('#pages');
      const footer=document.querySelector('.sidebar-bottom');
      const sidebar=document.querySelector('.sidebar');
      const l=list.getBoundingClientRect(),f=footer.getBoundingClientRect();
      return {listBottom:l.bottom,footerTop:f.top,footerBottom:f.bottom,
        sidebarBottom:sidebar.getBoundingClientRect().bottom,
        listHeight:list.clientHeight,listContentHeight:list.scrollHeight,
        viewportHeight:innerHeight};
    });
    console.log('Sidebar geometry',viewport,geometry);
    assert.ok(geometry.listHeight>0,'Page list has usable space');
    assert.ok(geometry.listContentHeight>geometry.listHeight,
      'Long PDF has its own scrollable page list');
    assert.ok(geometry.listBottom<=geometry.footerTop+1,
      'Page list ends above the sidebar action buttons');
    assert.ok(geometry.footerBottom<=Math.min(geometry.sidebarBottom,geometry.viewportHeight)+1,
      'Sidebar action buttons stay inside the visible window');
    // Scroll to and actually select the last page, then return to the first.
    await page.locator('.page-item').last().click();
    assert.match(await page.locator('#page-info').textContent(),/^Seite 40 von 40/);
    for(const id of ['demo','clear']){
      assert.equal(await page.locator('#'+id).evaluate(button=>{
        const r=button.getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return hit===button || button.contains(hit);
      }),true,id+' is visible and receives clicks');
    }
    await page.screenshot({path:'tests/output/seitenliste-'+viewport.width+'.png'});
    await page.locator('.page-item').first().click();
    assert.match(await page.locator('#page-info').textContent(),/^Seite 1 von 40/);
    await page.locator('#clear').click();
    assert.equal(await page.locator('.page-item').count(),0);
    await page.locator('#demo').click();
    assert.equal(await page.locator('.page-item').count(),1);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: 40-page PDF, last/first page selection, visible sidebar actions at three window sizes.');
}finally{await browser.close();}
