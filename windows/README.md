# KontoKlar · Version 1.1.1

Eine lokale Windows-Anwendung, um relevante Überweisungen aus Bildern und PDFs als geschwärzte Nachweise vorzubereiten.

Version 1.1.1 behebt die Meldung `pdf.destroy is not a function` beim PDF-Import und gibt die zugehörigen PDF-Worker auch nach fehlgeschlagenen Ladevorgängen frei.

## Starten unter Windows

1. `KontoKlar-Windows-x64.zip` herunterladen und **vollständig entpacken** (Rechtsklick → Alle extrahieren).
2. Im entpackten Ordner `KontoKlar` auf **KontoKlar.exe** doppelklicken. Die übrigen Dateien im Ordner werden zum Start benötigt.
3. Zum Ausprobieren auf **Beispiel ausprobieren** klicken. Im Ordner `Beispiele` liegen außerdem ein Bild und ein mehrseitiges PDF mit fiktiven Daten.

Unterstützt Windows 10/11 auf Intel-/AMD-Rechnern mit 64 Bit. Keine Installation, kein Python, kein Node.js, keine Anmeldung und keine Internetverbindung erforderlich. Die Anwendung ist nicht digital signiert; Windows kann deshalb einen Hinweis zu einem unbekannten Herausgeber anzeigen.

## Einen Nachweis erstellen

1. **Bilder oder PDFs öffnen**: PNG, JPG/JPEG, WebP, BMP sowie normale und eingescannte, mehrseitige PDFs. Dateien lassen sich auch in die Dokumentfläche ziehen.
2. **Suchbegriff eingeben**: Empfängername oder ein Teil des Verwendungszwecks. Mehrere alternative Begriffe mit Semikolon trennen, z. B. `Anna Beispiel; Unterstützung Oktober`. Die Suche unterscheidet nicht zwischen Groß-/Kleinschreibung und gleicht Umlaute an. Standardmäßig werden alle geöffneten Seiten durchsucht; das lässt sich abwählen.
3. **Passende Vorschläge übernehmen**: Rechts bei einem Treffer auf **Sichtbar lassen** klicken. Jede Übernahme gibt genau den im Dokument grün markierten Bereich frei. Die App versucht, mehrzeilige Buchungen anhand der Datumszeilen zu trennen.
4. **Grenzen kontrollieren und korrigieren**: Mit **Sichtbar markieren** lassen sich eigene Rechtecke aufziehen, etwa für Kontoinhaber, Auszugsdatum oder eine nicht erkannte Buchung. **Schwärzen** verdeckt zusätzliche Rechtecke und hat immer Vorrang. Mit × oder **Rückgängig** lassen sich Markierungen entfernen. **Buchungsbereich** grenzt die Tabelle ein; danach die Suche erneut starten.
5. **Exportvorschau einschalten**: Jetzt sind alle nicht freigegebenen Bereiche vollständig schwarz. Jede freigegebene Fläche kontrollieren und rechts die Prüfung bestätigen. Für weitere Seiten links die nächste Seite auswählen und genauso prüfen.
6. Unter **Seiten im PDF** wählen: **Nur Seiten mit Treffern** exportiert geprüfte Seiten mit übernommenen Treffern oder manuellen Freigaben. **Alle Seiten beibehalten** erhält alle geöffneten Seiten in ihrer ursprünglichen Reihenfolge; Seiten ohne Freigaben werden vollständig schwarz ausgegeben. In diesem Modus müssen sämtliche Seiten mit sichtbaren Freigaben vorher geprüft sein. Die Auswahl gilt für alle geöffneten Dokumente. Der Zähler zeigt Seitenzahl und Prüfstatus. Anschließend **Geschwärzte PDF speichern**. Der **PNG**-Export betrifft weiterhin nur die aktuelle geprüfte Seite.

## Was mit den Daten passiert

- Dokumente und Suchbegriffe werden auf dem eigenen Rechner verarbeitet. Die deutsche und englische Texterkennung sind mitgeliefert. Es gibt keine Cloud-API und keine ausgehenden Verbindungen aus der Dokumentansicht.
- PDFs werden vor der Bearbeitung in Seitenbilder umgewandelt. Der Export erzeugt **neue Bildpixel**, die zunächst vollständig schwarz sind. Nur explizit freigegebene Rechtecke werden hineinkopiert; zusätzliche Schwärzungen werden zuletzt angewendet.
- Die exportierte PDF enthält ausschließlich die bearbeiteten Seitenbilder, **keine ursprüngliche PDF, versteckte Textebene, Anhänge oder rückgängig machbaren Schwärzungsobjekte**. Der PNG-Export enthält ebenfalls nur die fertigen Bildpixel. Der lesbare Text wird beim PDF-Export zum Bild und ist anschließend nicht durchsuchbar.
- Originaldateien werden nicht verändert. Dokumente und Markierungen bleiben nur in der laufenden Sitzung. Die App speichert keine Projekte oder Dokumenthistorie. Beim Schließen gehen nicht exportierte Markierungen verloren. Ein Export wird als neue Datei gespeichert; wähle dafür einen neuen Dateinamen.

## Grenzen

Die Erkennung ist eine Hilfe und muss kontrolliert werden. Sie kann bei schrägen Fotos, geringer Auflösung, komplexen Tabellen oder mehreren Datumsangaben innerhalb einer Buchung danebenliegen. Ohne ausreichend erkennbare Datumsgrenzen werden keine Buchungsbereiche geraten; dann manuell markieren. Beträge und zugehörige Buchungszeilen sollten vollständig sichtbar bleiben. Ob das Finanzamt den geschwärzten Nachweis akzeptiert, hängt von den angeforderten Angaben ab; Originale aufbewahren.

Passwortgeschützte PDFs zunächst als unverschlüsselte Kopie bereitstellen. Zum Schutz vor Speicherüberlastung gelten pro Bild 25 Megapixel, pro Datei 150 MB und pro Sitzung insgesamt 100 Millionen Seitenpixel. Große PDFs können bis zur Sitzungsgrenze teilweise geladen werden; die Statuszeile meldet das. Weitere Dateien danach in einer neuen Sitzung bearbeiten. PDF-Seiten werden für die Bearbeitung mit bis zu 144 dpi gerendert.

## Entwicklung und Prüfung

Der Quellcode liegt im Unterordner `windows/` dieses Repositorys. Node.js 24 oder neuer wird für die Entwicklung empfohlen.

```sh
npm ci
npm start
```

Die mitgelieferten Dateien unter `src/vendor` sind die lokalen Laufzeitdateien für PDF.js, pdf-lib und Tesseract.js einschließlich deutscher und englischer Sprachdaten. Ein Entwicklungsserver lässt sich mit `npm run dev` starten (nur `127.0.0.1:4173`).

```sh
npm test
# Entwicklungsserver in einem zweiten Terminal starten:
npm run dev
npm run test:e2e
```

Die Oberflächentests nutzen auf dieser Linux-Testumgebung `/usr/bin/chromium`; für andere Systeme den Pfad in `tests/e2e.mjs` anpassen. Die Tests prüfen unter anderem mehrzeilige Treffer, manuelle Freigaben/Schwärzungen, den Vorrang von Schwärzungen, die Exportfreigabe, PDF- und Bildimport, lokale OCR, PNG-/PDF-Export sowie das Fehlen einer exportierten Textebene und ausgehender Netzwerkaufrufe.

Die App wurde in Chromium unter Linux funktional geprüft. Das Windows-Paket enthält die offizielle Electron-Laufzeit, deren SHA-256 gegen die veröffentlichten Prüfsummen verifiziert wurde. Ein Start auf einem echten Windows-Rechner wurde hier nicht getestet.

App-Quellcode: MIT-Lizenz. Drittanbieter-Lizenzen: `THIRD-PARTY-NOTICES.txt` sowie die mitgelieferten Electron-/Chromium-Lizenzen.
