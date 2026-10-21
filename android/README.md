# KontoKlar für Android · Version 1.2.3

Lokale Schwärzung von Kontoauszügen aus Bildern und mehrseitigen PDFs. Installation als APK, ohne Konto, ohne Cloud und ohne Internetberechtigung.

Version 1.2.3 behebt die Fehlermeldung `pdf.destroy is not a function` beim Abschluss des PDF-Imports. PDF-Ressourcen werden auch bei fehlgeschlagenen oder abgebrochenen Ladevorgängen freigegeben.

Version 1.2.2 korrigiert den Abstand zur Android-Statusleiste, zu Kameraausschnitten und zur unteren Navigationsleiste. Die Webansicht liegt nun in einem separaten nativen Rahmen innerhalb dieser Grenzen. Der verfügbare Bereich wird auch bei Drehung und eingeblendeter Tastatur angepasst.

## Installation

1. `KontoKlar-Android-v1.2.3.apk` auf das Android-Gerät herunterladen oder übertragen.
2. Die APK öffnen. Falls Android danach fragt, die Installation von Apps aus dieser Quelle für den verwendeten Browser/Dateimanager erlauben.
3. Installieren und **KontoKlar** öffnen. Zunächst **Beispiel ausprobieren** verwenden.

Voraussetzungen: **Android 10 oder neuer**, aktuelle Version von **Android System WebView** bzw. dem auf dem Gerät verwendeten WebView-Anbieter. Das Paket enthält keine CPU-spezifischen nativen Bibliotheken und ist für ARM- und x86-Geräte geeignet. Es wird direkt installiert und wurde nicht im Google Play Store veröffentlicht.

## Bedienung

Die drei Bereiche erreichst du über die Navigation unten:

- **Dokumente:** Bilder oder PDFs über die Android-Dateiauswahl öffnen. PNG, JPG, WebP, BMP sowie mehrseitige und eingescannte PDFs werden unterstützt. Fotos aus der Galerie können über die Dateiauswahl gewählt werden. Eine direkte Kameraaufnahme ist nicht eingebaut.
- **Bearbeiten:** Empfängername oder Verwendungszweck eingeben und **Buchungen finden** wählen. Standardmäßig werden alle geöffneten Seiten durchsucht. Alternative Begriffe mit Semikolon trennen. **Bewegen** erlaubt das Scrollen im Dokument. Mit **Sichtbar markieren**, **Schwärzen** oder **Buchungsbereich** ein Rechteck mit dem Finger aufziehen. Für genauere Markierungen die Ansicht auf 150–300 % vergrößern.
- **Prüfen & Speichern:** Passende Treffer mit **Sichtbar lassen** übernehmen. **Exportvorschau öffnen** zeigt die fertigen Bildpixel. Danach in **Prüfen & Speichern** die Prüfung der Seite bestätigen.

Beim PDF-Export kannst du wählen:

- **Nur Seiten mit Treffern:** Geprüfte Seiten mit übernommenen Treffern oder manuellen Freigaben exportieren; andere Seiten auslassen.
- **Alle Seiten beibehalten:** Alle geöffneten Seiten in ihrer Reihenfolge erhalten. Seiten ohne sichtbare Freigaben bleiben vollständig schwarz. Jede Seite mit einer Freigabe muss vorher geprüft sein.

**Geschwärzte PDF speichern** oder **Aktuelle Seite als PNG** öffnet den Android-Speicherdialog. Dort Dateinamen und Zielordner festlegen und **Speichern** wählen. Nach erfolgreichem Speichern erscheint eine Bestätigung. Der PDF-Export gilt für alle geöffneten Dokumente; PNG betrifft nur die aktuelle Seite.

## Was bedeutet Buchungsbereich?

Damit grenzt du auf der aktuellen Seite die Buchungstabelle für die Suche ein. Das hilft, wenn Kontokopf oder Fußzeilen die Erkennung stören.

1. Unter **Bearbeiten** auf **Buchungsbereich ⓘ** tippen. Die Erklärung erscheint direkt beim Werkzeug.
2. Ein Rechteck um die gesamte Buchungstabelle aufziehen, einschließlich Datum, Buchungstext und Betrag.
3. **Buchungen finden** erneut starten. Anschließend die passenden Treffer freigeben.

Der Buchungsbereich gilt nur für diese Seite. Welche Angaben im Export sichtbar bleiben, bestimmst du separat mit den Freigaben. Unter **Prüfen & Speichern** kann die Begrenzung mit **Buchungsbereich zurücksetzen** entfernt werden.

## Datenschutz und Grenzen

Die App hat **keine Internetberechtigung** und fordert keine pauschale Speicher-, Kamera- oder Fotoberechtigung an. Der Android-Dateidialog gibt ihr nur Zugriff auf die von dir ausgewählten Dateien. Deutsche und englische Texterkennung, PDF-Bibliotheken und Sprachmodelle sind im APK enthalten.

Originaldateien bleiben unverändert. Die Ausgabe wird aus neuen, zunächst schwarzen Seitenbildern aufgebaut. Nur ausdrücklich freigegebene Rechtecke werden aus dem Originalbild hineinkopiert. Zusätzliche Schwärzungen haben Vorrang. Die neue PDF enthält keine ursprünglichen PDF-Seiten, auslesbare Textebene oder rückgängig machbare Schwärzungen. Lesbarer Text ist danach Bestandteil eines Bildes und nicht durchsuchbar.

Dokumente und Markierungen bleiben nur in der laufenden Sitzung. Android kann Apps im Hintergrund beenden. Deshalb bis zum Export möglichst in der App bleiben; nicht exportierte Markierungen gehen beim Beenden verloren. Für den Speicherdialog wird ausschließlich die bereits geschwärzte Ausgabe kurz im privaten App-Cache gehalten. Diese Datei wird nach Speichern/Abbrechen gelöscht; liegengebliebene Ausgabepuffer werden beim nächsten Start entfernt. Automatische Android-Backups sind deaktiviert.

Die Erkennung kann bei unscharfen oder schrägen Bildern sowie abweichenden Banklayouts Fehler machen. Jede Freigabe und ihre Grenzen in der Vorschau prüfen. Ohne klare Datumsgrenzen bitte von Hand markieren. Kontoinhaber oder Auszugsdatum können ebenfalls separat freigegeben werden. Die Originale aufbewahren; die Akzeptanz durch das Finanzamt hängt von den geforderten Angaben ab.

Zum Begrenzen des Speicherbedarfs: maximal 16 Megapixel pro Bild, 80 MB pro Eingabedatei und insgesamt 30 Millionen Seitenpixel pro Sitzung. PDF-Seiten werden mit bis zu 108 dpi gerendert. Bei großen PDFs kann nur ein Teil geladen werden; die App meldet das. Weitere Seiten dann in einer neuen Sitzung bearbeiten. Passwortgeschützte PDFs zuvor als unverschlüsselte Kopie bereitstellen. Auf schwächeren Geräten benötigt die Offline-Texterkennung etwas Zeit.

## Quellcode und Build

Der Quellcode liegt im Unterordner `android/` dieses Repositorys. Die Datei `app/src/main/assets/web` enthält die vollständige, offline nutzbare Oberfläche einschließlich Bibliotheken und Sprachdaten. `MainActivity.java` verbindet diese mit Android-Dateidialogen und stellt lokale Ressourcen über eine feste, ausschließlich intern beantwortete HTTPS-Adresse bereit. Alle anderen Ressourcenaufrufe werden blockiert. Es ist kein Webserver und keine Netzwerkverbindung erforderlich.

Der Build verwendet offizielle Android SDK Build Tools 35.0.0, Android-Plattform 35, den Eclipse-Java-Compiler ECJ 3.39.0 und Java 21. Zum Bauen unter Linux:

```sh
# Werkzeuge nach scripts/setup_tools.py herunterladen und prüfen:
python scripts/setup_tools.py /pfad/zu/android-tools
ANDROID_TOOLS_DIR=/pfad/zu/android-tools bash scripts/build.sh
```

Beim ersten eigenen Build wird ein neuer Signierschlüssel im Ordner `signing/` angelegt. Schlüssel und Kennwortdatei sicher aufbewahren und nicht veröffentlichen. Der mitgelieferte Quellcode enthält den Signierschlüssel der ausgelieferten APK nicht. Ein mit einem anderen Schlüssel gebautes APK kann die bestehende Installation nicht direkt aktualisieren. Der Build benötigt das Internet zum erstmaligen Herunterladen der Werkzeuge; die fertige App funktioniert offline.

Die gemeinsamen Schwärzungsregeln stammen aus der Windows-Version. `scripts/sync_assets.py` kann bei vorhandenen gemeinsamen Quellen und installierten Node-Abhängigkeiten unter `windows/` die Oberfläche erneut übernehmen. Ohne diese Abhängigkeiten verwendet der Build die mitgelieferten Android-Assets.

Für die Tests der Oberfläche: Node.js installieren, `npm ci`, `npm run dev` und in einem zweiten Terminal `npm test` bzw. `npm run test:mobile` starten. Im Test wird `/usr/bin/chromium` verwendet; diesen Pfad bei Bedarf anpassen. Getestet werden Suche, mehrseitige PDFs, OCR, die beiden Seitenoptionen, Finger-Markierungen mit vergrößerter Ansicht, die Prüfpflicht und die an Android übergebenen PNG-/PDF-Daten. Die Exportdateien werden zusätzlich auf schwarze Pixel und das Fehlen einer Textebene kontrolliert.

Lizenz des App-Quellcodes: MIT. Hinweise und Lizenzen der enthaltenen Bibliotheken stehen in `THIRD-PARTY-NOTICES.txt`.

## Stand der Prüfung

Die APK wurde kompiliert und ihre Android-Signatur verifiziert. Acht Tests der gemeinsamen Regeln und die mobilen Oberflächentests sind erfolgreich, einschließlich Offline-OCR, PDF-/Bildimport, Finger-Markierungen, Seitenwahl und PNG-/PDF-Exportdaten. Die Ausgaben wurden unabhängig auf schwarze Pixel und eine fehlende PDF-Textebene geprüft. Der vollständige Gerätetest im hier verfügbaren Android-Emulator ließ sich wegen der langsamen und instabilen Software-Emulation nicht abschließen. Ein Test auf einem echten Android-Gerät steht noch aus.

Der zusätzliche Regressionstest `npm run test:pdf` prüft mehrmaligen PDF-Import, den fehlerfreien Abschluss, die Freigabe der PDF-Worker, beschädigte und passwortgeschützte Testdateien sowie den anschließenden erfolgreichen Import. Dazu den Android-Entwicklungsserver starten. Mit `KONTOKLAR_TEST_DESKTOP=1` wird zusätzlich der separat laufende Windows-Entwicklungsserver auf Port 4173 geprüft.
