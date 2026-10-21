from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT.parent/'windows'/'src'
LEGACY=SOURCE.parent/'node_modules/pdfjs-dist/legacy/build'
DEST=ROOT/'app/src/main/assets/web'

def sync():
    if not SOURCE.exists() or not LEGACY.exists():
        if (DEST/'index.html').exists():
            print('Using bundled Android assets (shared source/dependencies not available).')
            return
        raise FileNotFoundError('Shared source or bundled assets required')
    if DEST.exists():shutil.rmtree(DEST)
    shutil.copytree(SOURCE,DEST)
    # Legacy PDF.js includes compatibility polyfills for Android System WebView.
    legacy=LEGACY
    for filename in ['pdf.mjs','pdf.worker.mjs']:shutil.copy(legacy/filename,DEST/'vendor'/filename)
    for name in ['android.css','android.js']:shutil.copy(ROOT/'mobile'/name,DEST/name)
    index=(DEST/'index.html').read_text()
    index=index.replace('<link rel="stylesheet" href="style.css">','<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="android.css">')
    index=index.replace('<script type="module" src="app.mjs"></script>','<script src="android.js" defer></script><script type="module" src="app.mjs"></script>')
    index=index.replace('<span class="local"><i></i> Verarbeitung auf diesem Rechner</span>','<span class="local"><i></i> Offline <span>auf diesem Gerät</span></span>')
    index=index.replace('<div class="tools">','<div class="tools"><button data-mode="move">☝ Bewegen</button>')
    index=index.replace('</label></div>\n  <div id="stage"','</label><label class="mobile-zoom-label">Ansicht <select id="mobile-zoom"><option value="1">Passend</option><option value="1.5">150 %</option><option value="2">200 %</option><option value="3">300 %</option></select></label></div><p class="mobile-tip">Mit „Bewegen“ scrollen. Zum Freigeben oder Schwärzen das Werkzeug wählen und ein Rechteck mit dem Finger aufziehen.</p>\n  <div id="stage"')
    index=index.replace('<div id="selection-list"></div>','<div id="selection-list"></div><button id="mobile-preview" class="secondary wide">Exportvorschau öffnen</button><p class="hint">Vorschau ansehen, danach hier die Prüfung bestätigen.</p>')
    index=index.replace('<div class="export-box">','<div id="mobile-save-result" role="status"></div><div class="export-box">')
    index=index.replace('</main>','</main><nav class="mobile-nav" aria-label="Arbeitsschritte"><button data-tab-target="documents">▤ Dokumente</button><button data-tab-target="edit">✎ Bearbeiten</button><button data-tab-target="review">✓ Prüfen &amp; Speichern</button></nav>')
    index=index.replace('auf diesem Rechner','auf diesem Gerät')
    (DEST/'index.html').write_text(index)
    app=(DEST/'app.mjs').read_text()
    # Keep phone memory use bounded. The Windows source keeps its own limits.
    for old,new in [('100_000_000','30_000_000'),('150*1024*1024','80*1024*1024'),('größer als 150 MB','größer als 80 MB'),('25_000_000','16_000_000'),('25 Megapixel','16 Megapixel'),('Math.min(2,Math.sqrt(20_000_000','Math.min(1.5,Math.sqrt(6_000_000')]:app=app.replace(old,new)
    (DEST/'app.mjs').write_text(app)
    print('Android assets synchronized:',DEST)

if __name__=='__main__':sync()
