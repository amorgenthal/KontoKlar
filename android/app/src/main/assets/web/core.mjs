// Pure geometry and search. Kept separate so privacy-critical behavior is testable.
export function normalize(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function termsFrom(text) { return text.split(/[;\n]+/).map(normalize).filter(Boolean); }
export function matches(text, terms) {
  const n = normalize(text);
  return terms.some(t => n.includes(t));
}
export function exportPlan(pages, mode = 'hits') {
  const ready = pages.filter(p => p.reviewed && p.keeps.length);
  const pending = mode === 'all' ? pages.filter(p => p.keeps.length && !p.reviewed) : [];
  const selected = mode === 'all' ? [...pages] : ready;
  return {selected, pending, ready, canExport: ready.length > 0 && pending.length === 0};
}
export function clampRect(rect, width, height) {
  const x = Math.max(0, Math.min(width, Math.min(rect.x, rect.x + rect.w)));
  const y = Math.max(0, Math.min(height, Math.min(rect.y, rect.y + rect.h)));
  const right = Math.max(0, Math.min(width, Math.max(rect.x, rect.x + rect.w)));
  const bottom = Math.max(0, Math.min(height, Math.max(rect.y, rect.y + rect.h)));
  return {x, y, w: right - x, h: bottom - y};
}
export function linesFromWords(words) {
  const groups = new Map();
  for (const w of words) {
    const key = w.line;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  return [...groups.values()].map(items => {
    items.sort((a,b) => a.x0 - b.x0);
    return {text: items.map(w => w.text).join(' '),
      x0: Math.min(...items.map(w=>w.x0)), y0: Math.min(...items.map(w=>w.y0)),
      x1: Math.max(...items.map(w=>w.x1)), y1: Math.max(...items.map(w=>w.y1))};
  }).sort((a,b) => a.y0-b.y0 || a.x0-b.x0);
}
export function suggest(lines, query, width, height, area = {x:0,y:0,w:width,h:height}) {
  const terms = termsFrom(query);
  if (!terms.length) return {items: [], reason: 'Bitte einen Suchbegriff eingeben.'};
  const inside = lines.filter(l => l.y0 >= area.y && l.y1 <= area.y + area.h &&
    l.x1 > area.x && l.x0 < area.x + area.w);
  // A booking begins with a date in the left portion of the chosen table area.
  // Do not guess paragraph height when reliable booking boundaries are absent.
  const dated = inside.filter(l => l.x0 < area.x + area.w * 0.38 &&
    /^\s*\d{1,2}[./]\d{1,2}(?:[./](?:\d{2,4})?)?(?:\s|$)/.test(l.text));
  const anchors = [];
  for (const l of dated) {
    if (!anchors.length || l.y0 - anchors.at(-1).y0 > Math.max(8, (l.y1-l.y0)*0.65)) anchors.push(l);
  }
  if (anchors.length < 2) {
    return {items: [], reason: 'Keine sicheren Buchungsgrenzen erkannt. Markiere die gewünschten Buchungen mit „Sichtbar markieren“ direkt im Bild.'};
  }
  const items = [];
  for (let i=0; i<anchors.length; i++) {
    const start = anchors[i].y0;
    const end = i+1<anchors.length ? anchors[i+1].y0 : area.y+area.h;
    let rowLines = inside.filter(l => l.y0 >= start-1 && l.y0 < end-1).sort((a,b)=>a.y0-b.y0);
    if(i===anchors.length-1){
      let previousBottom=anchors[i].y1;const close=[];
      for(const line of rowLines){
        if(line.y0-previousBottom>Math.max(36,(line.y1-line.y0)*2.2))break;
        close.push(line);previousBottom=Math.max(previousBottom,line.y1);
      }
      rowLines=close;
    }
    const text = rowLines.map(l=>l.text).join('\n');
    if (!matches(text, terms)) continue;
    // Last row has no following anchor: only propose its recognized text extent.
    const bottom = Math.min(end-2,Math.max(...rowLines.map(l=>l.y1))+4);
    const top = Math.max(area.y, start-2);
    items.push({text, rect: clampRect({x:area.x,y:top,w:area.w,h:bottom-top},width,height), last:i===anchors.length-1});
  }
  return {items, reason: items.length ? '' : 'Kein passender Eintrag gefunden. Prüfe den Suchbegriff oder markiere die Buchung manuell.'};
}

// Start from fresh black pixels. Only explicitly kept rectangles are copied.
// Exclusions are applied LAST and therefore always win over kept areas.
export function sanitizedCanvas(page, createCanvas = () => document.createElement('canvas')) {
  const out = createCanvas(); out.width=page.width; out.height=page.height;
  const ctx = out.getContext('2d', {alpha:false});
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,out.width,out.height);
  ctx.imageSmoothingEnabled = false;
  for (const r0 of page.keeps) {
    const r = clampRect(r0, out.width, out.height);
    // Round inward so no pixel outside the selected region can leak.
    const x=Math.ceil(r.x), y=Math.ceil(r.y), right=Math.floor(r.x+r.w), bottom=Math.floor(r.y+r.h);
    if (right>x && bottom>y) ctx.drawImage(page.canvas,x,y,right-x,bottom-y,x,y,right-x,bottom-y);
  }
  for (const r0 of page.hides) {
    const r = clampRect(r0,out.width,out.height);
    ctx.fillRect(Math.floor(r.x),Math.floor(r.y),Math.ceil(r.x+r.w)-Math.floor(r.x),Math.ceil(r.y+r.h)-Math.floor(r.y));
  }
  return out;
}
