// Regression: a rendered PDF must finish without a spurious cleanup error,
// release its worker, and leave subsequent imports usable after failed loads.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
  const targets=[['Android','http://127.0.0.1:4174']];
  if(process.env.KONTOKLAR_TEST_DESKTOP==='1')targets.push(['Windows','http://127.0.0.1:4173']);
  for(const [name,url] of targets){
    const context=await browser.newContext({viewport:{width:412,height:915}});
    const page=await context.newPage(),workers=new Set(),errors=[];
    page.on('worker',w=>{workers.add(w);w.on('close',()=>workers.delete(w));});
    page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(()=>{window.unhandled=[];window.addEventListener('unhandledrejection',e=>window.unhandled.push(String(e.reason)));});
    await page.goto(url);
    const waitReleased=async()=>{
      const end=Date.now()+5000;
      while(workers.size && Date.now()<end)await new Promise(r=>setTimeout(r,30));
      assert.equal(workers.size,0,`${name}: PDF workers must be released`);
    };
    const waitDone=()=>page.waitForFunction(()=>!document.getElementById('add').disabled);
    for(let n=1;n<=3;n++){
      await page.locator('#files').setInputFiles('demo/Beispiel-mehrseitig.pdf');await waitDone();
      assert.equal(await page.locator('.page-item').count(),n*2);
      assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false,await page.locator('#status').textContent());
      assert.match(await page.locator('#status').textContent(),/2 Seite\(n\) geladen/);
      await waitReleased();
    }
    for(const file of [{name:'defekt.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\ninvalid test fixture')},'tests/fixtures/passwort.pdf']){
      await page.locator('#files').setInputFiles(file);await waitDone();
      assert.equal(await page.locator('.page-item').count(),6,'Rejected files must not add pages');
      assert.match(await page.locator('#status').textContent(),/PDF konnte nicht geöffnet werden/);
      assert.doesNotMatch(await page.locator('#status').textContent(),/destroy|is not a function/);
      await waitReleased();
    }
    await page.locator('#files').setInputFiles('demo/Beispiel-mehrseitig.pdf');await waitDone();
    assert.equal(await page.locator('.page-item').count(),8);
    assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false,await page.locator('#status').textContent());
    await waitReleased();assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.unhandled),[]);
    console.log(`PASS ${name}: repeated multipage PDF import, clean completion, no worker leak, damaged/encrypted PDF rejection, recovery.`);
    await context.close();
  }
}finally{await browser.close();}
