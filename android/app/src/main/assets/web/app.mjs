import * as pdfjs from './vendor/pdf.mjs';
import {suggest, sanitizedCanvas, clampRect, exportPlan} from './core.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
const state = {pages:[], index:-1, mode:window.KontoKlarPlatform?.mobile?'move':'keep', busy:false, worker:null, pixels:0};
let nextId=1, gesture=null;
const current = () => state.pages[state.index];
function status(text, error=false) { $('status').textContent=text; $('status').classList.toggle('error',error); }
function setBusy(value) { state.busy=value; updateControls(); renderPageList(); }
function updateControls() {
  const p=current();
  for(const id of ['add','demo','find','clear','undo']) $(id).disabled=state.busy;
  $('find').disabled=state.busy || !p;
  $('undo').disabled=state.busy || !p?.history.length;
  $('reviewed').disabled=state.busy || !p?.keeps.length || !$('preview').checked;
  $('reviewed').checked=Boolean(p?.reviewed);
  const all=$('export-scope').value==='all';
  const {ready,selected,pending,canExport}=exportPlan(state.pages,$('export-scope').value);
  const black=selected.filter(p=>!p.keeps.length).length;
  $('review-count').textContent=all
    ? `${selected.length} Seiten im PDF · ${black} vollständig geschwärzt${pending.length ? ` · ${pending.length} mit Freigaben noch zu prüfen` : ''}`
    : `${ready.length} von ${state.pages.length} Seiten geprüft und für den Export ausgewählt`;
  $('export-hint').textContent=all
    ? 'Alle geöffneten Seiten bleiben in ihrer Reihenfolge erhalten. Seiten ohne Freigabe werden vollständig geschwärzt. Seiten mit Freigaben müssen vorher geprüft sein.'
    : 'Nur geprüfte Seiten mit übernommenen Treffern oder manuellen Freigaben werden exportiert. Andere Seiten werden weggelassen.';
  $('export-pdf').disabled=state.busy || !canExport;
  $('export-pdf').textContent=`Geschwärzte PDF speichern${selected.length ? ` (${selected.length})` : ''}`;
  $('export-scope').disabled=state.busy;
  $('export-png').disabled=state.busy || !p?.reviewed || !p?.keeps.length;
  document.querySelectorAll('[data-mode]').forEach(b=> {b.disabled=state.busy || !p; b.classList.toggle('active',b.dataset.mode===state.mode);});
  $('preview').disabled=state.busy || !p;
  $('search-all').disabled=state.busy;
  $('paper').classList.toggle('marking',state.mode!=='move');
  $('tool-help').hidden=state.mode!=='area' || $('preview').checked || !p;
}
function remember(p) {
  p.history.push({keeps:structuredClone(p.keeps),hides:structuredClone(p.hides),area:p.area?{...p.area}:null});
  if(p.history.length>40)p.history.shift();
  p.reviewed=false;
}
function mergeLines(lines) {
  const out=[];
  for(const l of lines.sort((a,b)=>a.y0-b.y0 || a.x0-b.x0)) {
    if(!l.text.trim()) continue;
    let group=out.find(g=>Math.abs(g.base-l.y1)<Math.max(3,(l.y1-l.y0)*0.35));
    if(!group){group={base:l.y1,parts:[]};out.push(group);}group.parts.push(l);
  }
  return out.map(g=>({text:g.parts.sort((a,b)=>a.x0-b.x0).map(l=>l.text).join(' '),
    x0:Math.min(...g.parts.map(l=>l.x0)),y0:Math.min(...g.parts.map(l=>l.y0)),
    x1:Math.max(...g.parts.map(l=>l.x1)),y1:Math.max(...g.parts.map(l=>l.y1))}));
}
function addPage(canvas, name, lines=null) {
  if(state.pixels+canvas.width*canvas.height>30_000_000)throw Error('Die geöffneten Seiten sind zusammen zu groß. Bitte exportiere die bisherigen Seiten und öffne weitere Dokumente in einer neuen Sitzung.');
  const p={id:nextId++,canvas,width:canvas.width,height:canvas.height,name,lines,keeps:[],hides:[],area:null,history:[],proposals:[],reason:'',reviewed:false};
  state.pages.push(p);state.pixels+=p.width*p.height;
  if(state.index<0)state.index=0;
}
function makeCanvas(w,h) {const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
async function importFiles(files) {
  if(state.busy)return;
  setBusy(true);
  const errors=[];const oldLength=state.pages.length;
  try {
    for(const file of files) {
      try {
        status(`Öffne ${file.name} …`);
        if(file.size>80*1024*1024)throw Error('Die Datei ist größer als 80 MB. Bitte teile sie vorher auf.');
        if(file.type==='application/pdf' || /\.pdf$/i.test(file.name)) {
          const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),
            cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,
            standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,
            wasmUrl:new URL('./vendor/pdfwasm/',import.meta.url).href,isEvalSupported:false});
          // PDF.js 6 owns document/worker disposal on the loading task, not
          // PDFDocumentProxy. Use one disposal promise for completion, failure
          // and password cancellation so every import releases its worker.
          let disposal;
          const dispose=()=>disposal ??= task.destroy();
          task.onPassword=()=>{void dispose().catch(()=>{});};
          try {
            let pdf;
            try {pdf=await task.promise;} catch(e){throw Error('PDF konnte nicht geöffnet werden. Bei Passwortschutz bitte zuerst eine unverschlüsselte Kopie erstellen.');}
            for(let n=1;n<=pdf.numPages;n++) {
              status(`Lade ${file.name} · Seite ${n} von ${pdf.numPages} …`);
              const page=await pdf.getPage(n);
              const basic=page.getViewport({scale:1});
              const scale=Math.min(1.5,Math.sqrt(6_000_000/(basic.width*basic.height)));
              const vp=page.getViewport({scale});
              const canvas=makeCanvas(Math.ceil(vp.width),Math.ceil(vp.height));
              await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:vp,background:'#ffffff'}).promise;
              const text=await page.getTextContent();
              const lines=mergeLines(text.items.filter(t=>typeof t.str==='string').map(t=>{
                const tx=pdfjs.Util.transform(vp.transform,t.transform);const h=Math.hypot(tx[2],tx[3]);
                return {text:t.str,x0:tx[4],y0:tx[5]-h,x1:tx[4]+t.width*scale,y1:tx[5]};
              }));
              // Only use a substantial text layer. Scans fall back to local OCR.
              const hasTable=lines.filter(l=>/^\s*\d{1,2}[./]\d{1,2}(?:[./](?:\d{2,4})?)?(?:\s|$)/.test(l.text)).length>=2;
              addPage(canvas,`${file.name} · ${n}/${pdf.numPages}`,hasTable?lines:null);
              page.cleanup();renderPageList();
            }
          } finally {await dispose();}
        } else {
          if(!/\.(png|jpe?g|webp|bmp)$/i.test(file.name) && !['image/png','image/jpeg','image/webp','image/bmp'].includes(file.type))
            throw Error('Dieses Bildformat wird nicht unterstützt. Bitte PNG, JPG, WebP oder BMP verwenden.');
          const image=await createImageBitmap(file,{imageOrientation:'from-image'});
          try {
            if(image.width*image.height>16_000_000)throw Error('Dieses Bild ist größer als 16 Megapixel. Bitte vorher verkleinern.');
            const c=makeCanvas(image.width,image.height);const ctx=c.getContext('2d',{alpha:false});
            ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0);
            addPage(c,file.name);
          } finally {image.close();}
        }
      } catch(e){errors.push(`${file.name}: ${e.message}`);}
    }
    if(state.pages.length>oldLength)state.index=oldLength;
    render();
    status(errors.length?errors.join(' | '):`${state.pages.length-oldLength} Seite(n) geladen. Gib einen Suchbegriff ein oder markiere sichtbare Bereiche.`,Boolean(errors.length));
  } finally {setBusy(false);$('files').value='';}
}
function renderPageList() {
  $('pages').replaceChildren();
  state.pages.forEach((p,i)=>{
    const b=document.createElement('button');b.className=`page-item ${i===state.index?'active':''}`;
    const icon=document.createElement('span');icon.className='page-symbol';icon.textContent=p.reviewed?'✓':'▤';
    const t=document.createElement('span');const name=document.createElement('b');name.textContent=p.name;name.title=p.name;
    const small=document.createElement('small');small.textContent=`Seite ${i+1} · ${p.reviewed?'geprüft':p.proposals.length+' Treffer · '+p.keeps.length+' Freigaben'}`;
    t.append(name,small);b.append(icon,t);b.disabled=state.busy;
    b.onclick=()=>{if(state.busy)return;state.index=i;$('preview').checked=false;$('stage').scrollTop=0;render();status('Prüfe oder bearbeite die ausgewählte Seite.');};
    $('pages').append(b);
  });
}
function positionBox(el,r,p) {el.style.left=`${r.x/p.width*100}%`;el.style.top=`${r.y/p.height*100}%`;el.style.width=`${r.w/p.width*100}%`;el.style.height=`${r.h/p.height*100}%`;}
function render() {
  renderPageList();const p=current();$('empty').hidden=Boolean(p);$('paper').hidden=!p;
  $('rectangles').replaceChildren();$('selection-list').replaceChildren();$('suggestions').replaceChildren();
  if(p){
    const view=$('view');view.width=p.width;view.height=p.height;
    const ctx=view.getContext('2d',{alpha:false});
    if($('preview').checked){const clean=sanitizedCanvas(p);ctx.drawImage(clean,0,0);clean.width=clean.height=1;}
    else {
      ctx.drawImage(p.canvas,0,0);
      if(p.area){const box=document.createElement('div');box.className='mark area';positionBox(box,p.area,p);$('rectangles').append(box);}
      for(const type of ['keeps','hides'])p[type].forEach((r,i)=>{
        const box=document.createElement('div');box.className=`mark ${type==='hides'?'hide':''}`;positionBox(box,r,p);
        const remove=document.createElement('button');remove.textContent='×';remove.title='Markierung entfernen';
        remove.onpointerdown=e=>e.stopPropagation();remove.onclick=e=>{e.stopPropagation();if(state.busy)return;remember(p);p[type].splice(i,1);render();};
        box.append(remove);$('rectangles').append(box);
      });
    }
    p.proposals.forEach((s,i)=>{
      const card=document.createElement('div');card.className='suggestion';
      const text=document.createElement('pre');text.textContent=s.text;
      const btn=document.createElement('button');const added=p.keeps.some(r=>JSON.stringify(r)===JSON.stringify(s.rect));
      btn.textContent=added?'✓ Übernommen':'＋ Sichtbar lassen';btn.disabled=added || state.busy;
      btn.onclick=()=>{if(state.busy)return;remember(p);p.keeps.push({...s.rect});$('preview').checked=false;render();status('Vorschlag übernommen. Prüfe die Grenzen im Dokument und in der Exportvorschau.');};
      card.append(text,btn);
      if(s.last){const note=document.createElement('p');note.className='hint';note.textContent='Letzte erkannte Buchung: bitte untere Grenze besonders prüfen.';card.append(note);}
      $('suggestions').append(card);
    });
    if(!p.proposals.length){const m=document.createElement('div');m.className='muted-box';m.textContent=p.reason || 'Suche nach einem Begriff oder markiere direkt im Dokument.';$('suggestions').append(m);}
    for(const [type,title] of [['keeps','Sichtbarer Bereich'],['hides','Schwärzung']])p[type].forEach((r,i)=>{
      const row=document.createElement('div');row.className='selected-line';
      const t=document.createElement('span');t.textContent=`${type==='keeps'?'●':'▰'} ${title} ${i+1}`;
      const b=document.createElement('button');b.textContent='×';b.title='Entfernen';b.disabled=state.busy;
      b.onclick=()=>{if(state.busy)return;remember(p);p[type].splice(i,1);render();};row.append(t,b);$('selection-list').append(row);
    });
    if(p.area){const b=document.createElement('button');b.className='text-button wide';b.textContent='Buchungsbereich zurücksetzen';b.onclick=()=>{if(state.busy)return;remember(p);p.area=null;p.proposals=[];render();};$('selection-list').append(b);}
    $('page-info').textContent=`Seite ${state.index+1} von ${state.pages.length} · ${p.width} × ${p.height} Pixel`;
  } else {$('page-info').textContent='Noch keine Seite geladen';}
  updateControls();
}
async function findBookings() {
  const active=current();if(!active || state.busy)return;
  if(!$('query').value.trim()){status('Gib einen Namen oder Verwendungszweck ein.',true);$('query').focus();return;}
  setBusy(true);
  try {
    const targets=$('search-all').checked?state.pages:[active];let total=0;
    for(const p of targets){
    status(`Durchsuche Seite ${state.pages.indexOf(p)+1} von ${state.pages.length} …`);
    if(!p.lines){
      status('Lokale Texterkennung wird gestartet …');
      if(!state.worker)state.worker=await Tesseract.createWorker('deu+eng',1,{
        workerPath:new URL('./vendor/worker.min.js',import.meta.url).href,
        corePath:new URL('./vendor/core/',import.meta.url).href,
        langPath:new URL('./vendor/lang/',import.meta.url).href,
        workerBlobURL:false,cacheMethod:'none',
        logger:m=>{if(m.status==='recognizing text')status(`Lese Text auf diesem Rechner … ${Math.round(m.progress*100)} %`);}
      });
      const scale=Math.min(1,3000/Math.max(p.width,p.height));
      const c=makeCanvas(Math.round(p.width*scale),Math.round(p.height*scale));c.getContext('2d').drawImage(p.canvas,0,0,c.width,c.height);
      const result=await state.worker.recognize(c,{}, {blocks:true,text:true});c.width=c.height=1;
      const lines=[];
      for(const block of result.data.blocks || [])for(const para of block.paragraphs || [])for(const line of para.lines || [])
        lines.push({text:line.text.trim(),x0:line.bbox.x0/scale,y0:line.bbox.y0/scale,x1:line.bbox.x1/scale,y1:line.bbox.y1/scale});
      p.lines=mergeLines(lines);
    }
    const result=suggest(p.lines,$('query').value,p.width,p.height,p.area || undefined);
    p.proposals=result.items;p.reason=result.reason;
    total+=result.items.length;
    }
    status(total?`${total} Vorschlag/Vorschläge auf ${targets.length} durchsuchten Seite(n). Übernimm passende Buchungen und prüfe die markierten Grenzen.`:active.reason);
  } catch(e){status(`Texterkennung fehlgeschlagen: ${e.message}. Du kannst Bereiche weiterhin manuell markieren.`,true);if(state.worker){await state.worker.terminate().catch(()=>{});state.worker=null;}}
  finally{setBusy(false);render();}
}
function point(event,p) {const r=$('view').getBoundingClientRect();return {x:(event.clientX-r.left)/r.width*p.width,y:(event.clientY-r.top)/r.height*p.height};}
$('paper').onpointerdown=e=>{
  const p=current();if(!p || state.busy || state.mode==='move' || $('preview').checked || e.button!==0 || e.target.closest('button'))return;
  const pt=point(e,p);gesture={start:pt,page:p};$('paper').setPointerCapture(e.pointerId);e.preventDefault();
};
$('paper').onpointermove=e=>{
  if(!gesture)return;const p=gesture.page,pt=point(e,p);const r=clampRect({x:gesture.start.x,y:gesture.start.y,w:pt.x-gesture.start.x,h:pt.y-gesture.start.y},p.width,p.height);
  positionBox($('drawing'),r,p);$('drawing').style.display='block';
};
$('paper').onpointerup=e=>{
  if(!gesture)return;const {page:p,start}=gesture;gesture=null;$('drawing').style.display='none';
  const pt=point(e,p),r=clampRect({x:start.x,y:start.y,w:pt.x-start.x,h:pt.y-start.y},p.width,p.height);
  if(r.w<5 || r.h<5)return;remember(p);
  if(state.mode==='area'){p.area=r;p.proposals=[];p.reason='Buchungsbereich festgelegt. Starte die Suche erneut.';status('Buchungsbereich festgelegt. Starte die Suche erneut.');}
  else {p[state.mode==='hide'?'hides':'keeps'].push(r);status('Markierung hinzugefügt. Kontrolliere die Exportvorschau.');}
  render();
};
$('paper').onpointercancel=()=>{gesture=null;$('drawing').style.display='none';};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;$('preview').checked=false;render();});
$('undo').onclick=()=>{const p=current(),prev=p?.history.pop();if(prev){Object.assign(p,prev);p.reviewed=false;render();}};
$('preview').onchange=()=>{render();if($('preview').checked)status('Dies sind die Bildpixel, die exportiert werden. Bestätige rechts die Prüfung, wenn alles passt.');};
$('reviewed').onchange=()=>{const p=current();if(p){p.reviewed=$('reviewed').checked;renderPageList();updateControls();status(p.reviewed?'Seite geprüft und für den Export ausgewählt.':'Seite aus der Exportauswahl entfernt.');}};
$('find').onclick=findBookings;$('query').onkeydown=e=>{if(e.key==='Enter')findBookings();};
$('add').onclick=$('empty-add').onclick=()=>$('files').click();$('files').onchange=e=>importFiles([...e.target.files]);
for(const name of ['dragenter','dragover'])$('stage').addEventListener(name,e=>{e.preventDefault();$('stage').classList.add('dragover');});
$('stage').ondragleave=()=>$('stage').classList.remove('dragover');
$('stage').ondrop=e=>{e.preventDefault();$('stage').classList.remove('dragover');importFiles([...e.dataTransfer.files]);};
document.addEventListener('dragover',e=>e.preventDefault());document.addEventListener('drop',e=>e.preventDefault());
$('clear').onclick=()=>{
  if(state.busy || !state.pages.length)return;
  if(!confirm('Alle Dokumente und Markierungen aus dieser Sitzung entfernen? Nicht exportierte Markierungen gehen verloren.'))return;
  state.pages.forEach(p=>p.canvas.width=p.canvas.height=1);state.pages=[];state.index=-1;state.pixels=0;$('preview').checked=false;render();status('Dokumente aus der Sitzung entfernt.');
};
async function download(blob,name) {
  if(window.KontoKlarPlatform?.saveFile){await window.KontoKlarPlatform.saveFile(blob,name);return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
$('export-png').onclick=async()=>{
  const p=current();if(state.busy || !p?.reviewed || !p.keeps.length)return;
  setBusy(true);try{const c=sanitizedCanvas(p);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));c.width=c.height=1;if(!blob)throw Error('PNG konnte nicht erzeugt werden.');await download(blob,`Nachweis_Seite_${state.index+1}_geschwaerzt.png`);status('Geschwärzte PNG erstellt. Im Speicherdialog den Zielordner wählen.');}catch(e){status(e.message,true);}finally{setBusy(false);}
};
$('export-pdf').onclick=async()=>{
  if(state.busy)return;
  const all=$('export-scope').value==='all';
  const {selected,canExport}=exportPlan(state.pages,$('export-scope').value);if(!canExport)return;
  setBusy(true);
  try{
    const doc=await PDFLib.PDFDocument.create();doc.setTitle('Geschwärzte Nachweise');doc.setProducer('KontoKlar');doc.setCreator('KontoKlar');
    for(let i=0;i<selected.length;i++){
      status(`Erstelle geschwärzte PDF · Seite ${i+1} von ${selected.length} …`);
      const p=selected[i],c=sanitizedCanvas(p);
      const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));c.width=c.height=1;
      if(!blob)throw Error('Seitenbild konnte nicht erzeugt werden.');
      const img=await doc.embedPng(await blob.arrayBuffer());
      const scale=Math.min(1,842/Math.max(p.width,p.height));
      const page=doc.addPage([p.width*scale,p.height*scale]);page.drawImage(img,{x:0,y:0,width:p.width*scale,height:p.height*scale});
    }
    await download(new Blob([await doc.save()],{type:'application/pdf'}),'Nachweise_geschwaerzt.pdf');
    status(all
      ? `${selected.length} Seite(n) als neue Bild-PDF erstellt. Alle Seiten beibehalten; ${selected.filter(p=>!p.keeps.length).length} Seite(n) vollständig geschwärzt.`
      : `${selected.length} geprüfte Trefferseite(n) als neue Bild-PDF erstellt. ${state.pages.length-selected.length} weitere Seite(n) ausgelassen.`);
  }catch(e){status(`Export fehlgeschlagen: ${e.message}`,true);}finally{setBusy(false);}
};
$('export-scope').onchange=()=>updateControls();
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
$('demo').onclick=()=>{
  if(state.busy)return;
  const c=makeCanvas(1240,1754),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  const lines=[];const line=(text,x,y,size=22)=>{ctx.font=`${size}px Arial`;ctx.fillStyle='#17283e';ctx.fillText(text,x,y);lines.push({text,x0:x,y0:y-size,x1:x+ctx.measureText(text).width,y1:y+3});};
  line('BEISPIELBANK',80,100,34);line('DEMO · FIKTIVE DATEN',80,150,19);line('Kontoauszug · Oktober 2026',80,235,28);
  line('Kontoinhaber: Max Mustermann',80,290);line('IBAN: DE00 0000 0000 0000 0000 00',80,330);
  line('Buchung / Verwendungszweck                                             Betrag',80,440,21);
  ctx.strokeStyle='#cbd4df';ctx.beginPath();ctx.moveTo(80,465);ctx.lineTo(1160,465);ctx.stroke();
  line('01.10.2026  Supermarkt                                                -42,50 EUR',80,520);
  line('Kartenzahlung Einkauf',240,558);
  line('04.10.2026  Anna Beispiel                                             -350,00 EUR',80,670);
  line('Unterstützung Oktober',240,708);line('Überweisung · Referenz 2026-10',240,746);
  line('08.10.2026  Stadtwerke                                                -68,00 EUR',80,860);
  line('Abschlag Strom',240,898);
  line('12.10.2026  Anna Beispiel                                             -120,00 EUR',80,1010);
  line('Gemeinsame Kosten',240,1048);line('Überweisung · Referenz 2026-10B',240,1086);
  line('15.10.2026  Buchhandlung                                              -24,90 EUR',80,1200);
  line('Kartenzahlung',240,1238);line('Ende des Auszugs · Seite 1 von 1',80,1620,19);
  addPage(c,'Beispiel-Kontoauszug.png',lines);state.index=state.pages.length-1;$('query').value='Anna Beispiel';$('preview').checked=false;render();status('Fiktives Beispiel geladen. Klicke auf „Buchungen finden“.');
};
window.addEventListener('beforeunload',()=>{state.worker?.terminate();});
// Warn before an accidental close when the session contains selections.
window.addEventListener('beforeunload',e=>{if(state.pages.some(p=>p.keeps.length)){e.preventDefault();e.returnValue='';}});
render();
