import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,termsFrom,matches,suggest,clampRect,exportPlan} from '../src/core.mjs';
const l=(text,y,x=50)=>({text,x0:x,y0:y,x1:900,y1:y+20});
test('PDF page selection keeps original order and can retain fully masked pages',()=>{
  const pages=[{id:1,reviewed:false,keeps:[]},{id:2,reviewed:true,keeps:[{}]},{id:3,reviewed:false,keeps:[]}];
  assert.deepEqual(exportPlan(pages,'hits').selected.map(p=>p.id),[2]);
  const all=exportPlan(pages,'all');assert.deepEqual(all.selected.map(p=>p.id),[1,2,3]);assert.equal(all.canExport,true);
});
test('all-page export requires review of every visible selection; empty projects cannot export',()=>{
  const pages=[{reviewed:true,keeps:[{}]},{reviewed:false,keeps:[{}]}];
  assert.equal(exportPlan(pages,'all').canExport,false);assert.equal(exportPlan(pages,'all').pending.length,1);
  assert.equal(exportPlan(pages,'hits').canExport,true);
  assert.equal(exportPlan([{reviewed:false,keeps:[]}],'all').canExport,false);
});
test('search supports umlauts, punctuation, OCR line breaks and OR terms',()=>{
  assert.equal(normalize('MÜLLER / Straße'),'muller strasse');
  assert.ok(matches('Anna\nBeispiel: Unterstützung',termsFrom('unbekannt; Anna Beispiel')));
  assert.ok(!matches('Andere Empfänger',termsFrom('Anna Beispiel')));
});
test('matching multiline booking stays within its own date anchors',()=>{
  const result=suggest([l('01.10.2026 Supermarkt',100),l('Privat',135),l('04.10.2026 Anna Beispiel',220),l('Unterstützung Oktober',255,200),l('08.10.2026 Andere Person',330)],'Anna Beispiel',1000,1500);
  assert.equal(result.items.length,1);const {rect,text}=result.items[0];
  assert.ok(rect.y>135 && rect.y+rect.h<330);assert.match(text,/Unterstützung/);assert.doesNotMatch(text,/Andere Person|Privat/);
});
test('unknown layout never guesses a booking region',()=>{
  const result=suggest([l('Anna Beispiel',100),l('Andere Überweisung',140)],'Anna',1000,1500);
  assert.equal(result.items.length,0);assert.match(result.reason,/manuell|Markiere/);
});
test('last booking does not include remote footer or private balances',()=>{
  const result=suggest([l('01.10. Supermarkt',100),l('04.10. Anna Beispiel',200),l('Verwendungszweck',235),l('Privater Kontostand',1000)],'Anna',1000,1500);
  assert.equal(result.items.length,1);assert.ok(result.items[0].rect.y+result.items[0].rect.h<300);assert.doesNotMatch(result.items[0].text,/Kontostand/);
});
test('chosen table region excludes unrelated matches elsewhere',()=>{
  const lines=[l('01.10.2026 Anna',100),l('04.10.2026 Anna',300),l('08.10.2026 Supermarkt',450)];
  const result=suggest(lines,'Anna',1000,1500,{x:0,y:250,w:1000,h:400});
  assert.equal(result.items.length,1);assert.ok(result.items[0].rect.y>=250);
});
test('empty queries and clipped rectangles are safe',()=>{
  assert.equal(suggest([l('01.10. Anna',100),l('02.10. Bob',200)],'',1000,1500).items.length,0);
  assert.deepEqual(clampRect({x:100,y:100,w:-200,h:-300},80,80),{x:0,y:0,w:80,h:80});
});
