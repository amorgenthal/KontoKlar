# KontoKlar

Kontoauszüge aus Bildern und mehrseitigen PDFs lokal schwärzen und relevante Überweisungen als Nachweis exportieren. Du suchst nach Empfänger oder Verwendungszweck, prüfst die vorgeschlagenen Buchungen und gibst die gewünschten Bereiche frei. Alles andere wird im Export fest geschwärzt.

## Herunterladen

Die fertigen Anwendungen stehen unter **[Releases](https://github.com/amorgenthal/KontoKlar/releases/latest)** bereit:

| Plattform | Aktuelle Version | Download | Voraussetzung |
| --- | --- | --- | --- |
| Android | 1.2.3 | [APK herunterladen](https://github.com/amorgenthal/KontoKlar/releases/download/v1.2.3/KontoKlar-Android-v1.2.3.apk) | Android 10 oder neuer, aktuelles Android System WebView |
| Windows | 1.1.1 | [Windows-ZIP herunterladen](https://github.com/amorgenthal/KontoKlar/releases/download/v1.2.3/KontoKlar-Windows-x64-v1.1.1.zip) | Windows 10/11, Intel/AMD mit 64 Bit |

**Android:** APK auf dem Gerät öffnen und installieren. Falls erforderlich, die Installation aus der verwendeten Quelle erlauben. Updates können über die bisherige Installation installiert werden.

**Windows:** ZIP vollständig entpacken und im Ordner `KontoKlar` die Datei `KontoKlar.exe` starten. Die weiteren Dateien im Ordner werden benötigt. Python und Node.js sind für die fertige Anwendung nicht erforderlich.

## Funktionen

- PNG, JPG/JPEG, WebP, BMP und mehrseitige PDFs öffnen, einschließlich gescannter PDFs.
- Lokal nach Empfängername oder Verwendungszweck suchen. Deutsche und englische OCR-Sprachmodelle sind mitgeliefert.
- Treffer prüfen und freigeben; zusätzliche Bereiche mit Maus oder Finger sichtbar markieren bzw. schwärzen.
- Mit **Buchungsbereich** die Buchungstabelle einer Seite für die Suche eingrenzen. Datum, Text und Betrag einschließen und danach erneut suchen.
- Bei mehrseitigen Dokumenten zwischen **Nur Seiten mit Treffern** und **Alle Seiten beibehalten** wählen. Beibehaltene Seiten ohne Freigaben werden vollständig geschwärzt.
- Geprüfte Seiten als neue PDF oder die aktuelle Seite als PNG speichern.

Auf Android erreichst du die einzelnen PDF-Seiten unter **Dokumente**. **Bewegen** scrollt innerhalb einer Seite; mit der Ansichtsvergrößerung lassen sich genauere Markierungen setzen.

## Verarbeitung und Schwärzung

Die Dokumentverarbeitung läuft auf dem eigenen Gerät. Die Android-App hat keine Internetberechtigung. Die Windows-App verwendet mitgelieferte Bibliotheken und einen ausschließlich lokal erreichbaren Ressourcenserver; ausgehende Aufrufe aus der Dokumentansicht werden blockiert.

Der Export beginnt mit vollständig schwarzen Seitenbildern. Nur explizit freigegebene Rechtecke werden hineinkopiert; zusätzliche Schwärzungen werden zuletzt angewendet. Die exportierte PDF enthält ausschließlich diese fertigen Bilder, keine ursprünglichen PDF-Seiten oder versteckte Textebene. Die Originaldateien werden beim Bearbeiten nicht verändert.

Die Erkennung kann bei abweichenden Banklayouts oder unscharfen Bildern Fehler machen. Prüfe die Grenzen jeder freigegebenen Buchung vor dem Export. Dokumente und Markierungen bleiben nur während der laufenden Sitzung erhalten. Der Android-Speicherdialog verwendet kurzfristig einen privaten Puffer der bereits geschwärzten Ausgabe.

## Quellcode und Anleitungen

| Verzeichnis | Inhalt |
| --- | --- |
| [`android/`](android/) | Android-App, mobile Oberfläche, vollständige Offline-Assets und Buildskripte |
| [`windows/`](windows/) | Electron-Anwendung, gemeinsame Such-/Schwärzungslogik und Windows-Packager |
| [`android/README.md`](android/README.md) | Installation, Bedienung, Grenzen und Android-Build |
| [`windows/README.md`](windows/README.md) | Windows-Anleitung und Entwicklung |

Die Beispielbilder und PDFs enthalten ausschließlich fiktive Daten. Signierschlüssel, persönliche Dokumente, lokale Abhängigkeiten und generierte Builds gehören nicht zum Repository.

## Entwicklung

### Windows

Node.js 24 oder neuer:

```sh
cd windows
npm ci
npm start
```

`npm run dev` startet die Oberfläche zum Entwickeln auf `http://127.0.0.1:4173`. Der Windows-Packager unter `scripts/package.py` verwendet die offizielle Electron-Laufzeit und prüft deren SHA-256. Details stehen in der Windows-Anleitung.

### Android

Unter Linux werden Java 21, Python 3 und die offiziellen Android-Buildwerkzeuge verwendet. Vom Repository-Hauptverzeichnis aus:

```sh
python android/scripts/setup_tools.py "$PWD/.android-tools"
ANDROID_TOOLS_DIR="$PWD/.android-tools" bash android/scripts/build.sh
```

Das APK entsteht unter `android/build/`. Beim ersten eigenen Build wird ein lokaler Signierschlüssel erzeugt. Ein mit einem anderen Schlüssel signiertes APK kann eine vorhandene Installation mit dem ursprünglichen Schlüssel nicht direkt aktualisieren. Der Schlüssel der veröffentlichten APKs ist nicht im Repository enthalten.

Die vollständigen Android-Web-Assets sind eingecheckt, sodass der Android-Build keine Node-Installation benötigt. Zum Abgleichen mit den gemeinsamen Quellen führt `sync_assets.py` die Dateien aus `windows/src` zusammen; dafür müssen die Node-Abhängigkeiten unter `windows/` installiert sein. Andernfalls bleiben die mitgelieferten Android-Assets in Verwendung.

## Prüfungen

```sh
cd windows
npm ci
npm test

cd ../android
npm ci
npm test
```

Für die Oberflächentests zusätzlich die Entwicklungsserver starten:

- Windows: `npm run dev` und in einem zweiten Terminal `npm run test:e2e`.
- Android: `npm run dev` und in einem zweiten Terminal `npm run test:mobile` bzw. `npm run test:pdf`.

Die Tests verwenden `/usr/bin/chromium`; diesen Pfad bei Bedarf anpassen. Der PDF-Regressionstest prüft mehrmaliges Laden, den fehlerfreien Abschluss, die Freigabe von PDF-Workern, beschädigte/passwortgeschützte Testdateien und den anschließenden erfolgreichen Import. Mit `KONTOKLAR_TEST_DESKTOP=1 npm run test:pdf` wird zusätzlich der laufende Windows-Entwicklungsserver geprüft.

Die Funktionen und Exportdaten wurden mit synthetischen Beispielen in Chromium getestet. Ein vollständiger Test auf echten Android- und Windows-Geräten steht noch aus.

## Lizenzen

Die bestehende Repository-Lizenz steht in [`LICENSE`](LICENSE). Die Unterprojekte enthalten eigene MIT-Lizenzhinweise; die Lizenzen der mitgelieferten Bibliotheken und Sprachdaten sind in den jeweiligen Dateien `THIRD-PARTY-NOTICES.txt` und den Bibliotheksverzeichnissen dokumentiert.
