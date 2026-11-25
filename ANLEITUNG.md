# Reiseatelier (universell) – Anleitung

Reiseplanung für jede Art von Reise: Route mit Karte, Reiseplanung, Einreise-Checkliste, Notfall mit Notrufnummern aller Länder, Reisetagebuch mit Fotos und Countdown. Mehrere Reisen pro Gerät. Kein Konto und kein Server mit Datenbank nötig: reine Dateien (HTML, CSS, JavaScript), die auf jedem Webspace mit HTTPS laufen. Die Daten bleiben auf den Geräten, Mitreisende gleichen über eine Datei in einem geteilten Ordner ab.

## 1. Online stellen (einmalig, ca. 10 Minuten)

HTTPS ist Pflicht, sonst funktionieren App-Installation und Offline-Modus nicht.

**GitHub Pages:** Neues öffentliches Repository anlegen (z. B. `reiseatelier-universal`), den **Inhalt** dieses Ordners hochladen (`index.html` muss oben liegen), dann Settings → Pages → „Build and deployment“ → Source: **„GitHub Actions“**. Die mitgelieferte Action „Seite und Kartenpakete“ (`.github/workflows/pages.yml`) veröffentlicht bei jedem Push die App und baut dabei die Offline-Kartenpakete (Abschnitt 8). Nach wenigen Minuten ist die App unter `https://DEINNAME.github.io/reiseatelier-universal/` erreichbar. Ohne Offline-Karten geht auch „Deploy from a branch“ → `main`, `/ (root)`.

**Netlify:** „Add new site → Deploy manually“ und den Ordner ins Fenster ziehen.

**Raspberry Pi:** Ordner mit nginx, Caddy oder `python3 -m http.server` ausliefern, HTTPS von außen z. B. über Cloudflare Tunnel oder Tailscale Funnel.

Läuft schon das ursprüngliche Reiseatelier auf derselben Domain (z. B. beide auf `DEINNAME.github.io`), stört das nicht: Diese Version nutzt eigene Speicher- und Cache-Namen.

## 2. Installieren

- **iPhone/iPad:** Link in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach nur noch das Symbol benutzen – Safari löscht Daten von Webseiten, die eine Woche lang nicht geöffnet wurden; die installierte App ist davon ausgenommen.
- **Android (Chrome):** Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.
- **Windows/Mac (Chrome, Edge):** Installieren-Symbol in der Adressleiste. Safari auf dem Mac: „Ablage → Zum Dock hinzufügen“.

## 3. Mehrere Reisen

Oben rechts steht der Name der geöffneten Reise. Antippen öffnet „Meine Reisen“: wechseln, neue Reise anlegen (mit Name und Art), duplizieren (z. B. als Vorlage für die nächste Reise) oder löschen. Jede Reise hat eigene Route, Planung, Einreise-Checkliste, Notfallangaben, Tagebuch, Sicherungen und eine eigene Abgleich-Datei.

**Art der Reise** (Einstellungen): Rundreise/Roadtrip, Städtereise, Badeurlaub, Wander- oder Radreise, Kreuzfahrt, Sonstige. Davon hängen Stationsarten, Felder und Texte ab. Nur bei Kreuzfahrten gibt es „Alle an Bord“, Hafenagent, Schiff/Kabine, „Schiff verpasst?“ und Seemeilen/Seetage. Bei allen anderen Reisen tragt ihr pro Station die Unterkunft mit Adresse und Telefon ein – das erscheint im Notfall-Tab und auf der Taxi-Karte.

## 4. Gemeinsam aktuell halten

1. **Einmalig:** Einen Ordner „Reiseatelier“ in iCloud Drive, Google Drive, OneDrive, Dropbox oder Nextcloud anlegen und mit den Mitreisenden teilen (mit Bearbeitungsrecht).
2. **Bevor man etwas ändert:** „Laden“ und die Abgleich-Datei der Reise aus dem Ordner wählen.
3. **Nachdem man etwas geändert hat:** „Speichern“ → Datei in den Ordner legen → **Ersetzen**.

Jede Reise hat ihre eigene Datei, benannt nach dem Reisenamen (z. B. `reiseatelier-roadtrip-schottland-2027.json`). Beim Laden wird zusammengeführt, nicht überschrieben: Pro Station und Tagebucheintrag gewinnt die neuere Änderung, Löschungen werden übernommen, vorher wird eine Sicherheitskopie angelegt.

- Datei einer **anderen vorhandenen Reise** geladen? Die App bietet an, zu dieser Reise zu wechseln.
- Datei einer **Reise, die es auf dem Gerät noch nicht gibt**? Die App legt sie als neue Reise an. So kommt eine Reise auch auf ein neues Gerät.
- **Dateien aus dem ursprünglichen Reiseatelier** (ohne Reise-Kennung) werden in die gerade geöffnete Reise übernommen. Dafür vorher eine leere Reise anlegen.

**Android mit Google Drive:** „Abgleich-Datei speichern“ öffnet das Teilen-Menü → *In Drive speichern* → Ordner wählen. Zum Laden im Dateiauswahl-Menü links *Drive* wählen. Google Drive ersetzt keine Dateien, sondern legt bei gleichem Namen eine weitere an. Entweder die alte Datei in der Drive-App löschen oder beim Laden einfach alle Dateien markieren – die App führt mehrere Dateien nacheinander zusammen (älteste zuerst). Lässt Android das Teilen als `.json` nicht zu, speichert die App die Datei als `.txt`; beide werden gelesen. In gemischten Gruppen (iPhone und Android) nutzen am besten alle Google Drive – auf dem iPhone erscheint es in der Dateien-App, dort funktioniert „Ersetzen“.

## 5. Route importieren und exportieren

Unter Einstellungen → „Route importieren & exportieren“:

- **Kalenderdatei (.ics)** aus Google-, Apple- oder Outlook-Kalender: jeder Termin wird eine Station (Ort aus „Ort“/Titel, Koordinaten aus GEO).
- **Tabelle (.csv)** aus Excel/Numbers mit Kopfzeile, z. B. `Ort;Land;Ankunft;Abreise;Notiz` (auch Englisch: `Place;Country;Arrival;Departure;Notes`).
- **Text einfügen**: eine Station pro Zeile mit Datum, z. B. `12.05.2027 Lissabon`, `14.05.–17.05.2027 Porto, Portugal`, `So 18.05. 08:00–18:00 Vigo`, `18. Mai 2027 Rom`. Jahre ohne Angabe werden ergänzt, „ab 18:00“ wird als Abreise erkannt, „Seetag“ als Reisetag.

**Buchungsbestätigungen:** Den ganzen Text einer Bestätigungsmail einfügen. Erkannt werden Hotels (Name, Check-in/Check-out bzw. Anreise/Abreise mit Uhrzeit, Adresse und Telefon – landen als Unterkunft samt Notfallangaben), Flüge (Flughafencodes wie „(FRA) – (HND)“, Flugnummer, Ankunftszeit; der Rückflug nach Hause ist in der Vorschau abgewählt) und Kreuzfahrt-Verläufe als Tabelle. Zeilen wie Buchungsdatum oder Zahlungsfristen werden übersprungen.

**Teilen an Reiseatelier (Android):** Ist die App installiert, erscheint sie im Teilen-Menü. In der Mail-App oder im Browser den Reiseverlauf markieren → Teilen → „Reiseatelier“, die Import-Vorschau öffnet sich direkt. Auch .ics-Dateien lassen sich so teilen. Nur ein geteilter Link reicht nicht – Webseiten kann die App nicht selbst lesen. Auf iPhone und iPad erlaubt Apple das Teilen an Web-Apps nicht, dort Text kopieren und unter Einstellungen einfügen.

Orte und Länder erkennt die App über die eingebaute Ortsliste (auch deutsche Namen wie München, Rom, Lissabon). Vor dem Übernehmen gibt es eine Vorschau, in der sich Name, Land und Daten ändern lassen. **Export:** „Route als .ics exportieren“ schreibt alle Stationen und Ausflüge mit Uhrzeit in eine Kalenderdatei.

## 6. Einreise (Staatsangehörigkeit Deutschland)

Der Tab „Einreise“ erzeugt die Checkliste aus der Route:

- **Allgemein:** Pass/Ausweis, Auslandskrankenversicherung, Reisemedizin, Krisenvorsorgeliste ELEFAND, je nach Reiseart Führerschein und Veranstalter-Unterlagen.
- **Hinterlegte Länder** mit Zeitfenster, Kosten und offiziellem Link (Stand 22.11.2026): UK ETA, ESTA (USA), eTA (Kanada), eVisitor (Australien), NZeTA (Neuseeland), Indonesien (e-VOA, Einreisekarte, Bali-Abgabe), Thailand (TDAC), Singapur, Malaysia, Sri Lanka, Malediven, Seychellen, Kap Verde.
- **EU/EWR/Schweiz:** „Keine Formalitäten nötig“.
- **Alle anderen Länder:** Aufgabe „Einreisebestimmungen prüfen“ (6 Wochen vor Ankunft) mit Link zum Auswärtigen Amt.
- **Eigene Aufgaben** mit Fälligkeitsdatum und Land, z. B. ein Visum, das ihr beim Auswärtigen Amt gefunden habt.

Bis zu 6 Reisende können getrennt abhaken. Ist etwas fällig, erscheint ein Hinweis auf der Startseite.

## 7. Notfall

- **Örtliche Notrufnummern für alle 249 Länder und Gebiete** – Polizei, Rettung, Feuerwehr bzw. allgemeiner Notruf, mit Hinweisen (z. B. Touristenpolizei). Gleiche Nummern werden zusammengefasst. Wo die Quellen uneinheitlich sind, steht ein Warnhinweis. Stand 22.11.2026.
- **Länder der Route** automatisch, dazu „Alle Länder nachschlagen“ für jedes Land.
- **Deutschland:** Auswärtiges Amt (24 h), Sperr-Notruf, Giftnotruf, Links zu Reise- und Sicherheitshinweisen und ELEFAND.
- **Deutsche Vertretungen live:** Beim Öffnen des Notfall-Tabs ruft die App die Vertretungen über die OpenData-Schnittstelle des Auswärtigen Amts ab (höchstens alle 3 Tage, oder per „↻ Aktualisieren“) und speichert sie für offline. Unter „Wichtige Nummern aus Deutschland“ steht, ob und wann der Abruf geklappt hat. Klappt er nicht (offline oder vom Browser blockiert), gelten die hinterlegten Vertretungen für 26 Länder (Stand 18.11.2026) bzw. der Link zu den Länderseiten des Auswärtigen Amts.
- **Eure Angaben:** Versicherung, Veranstalter/Reederei, Kontaktpersonen, Arzt, Medizinisches.
- **Taxi-Karte** in der Landessprache (mit Unterkunft und Adresse bzw. bei Kreuzfahrten mit Schiff, Hafen und „Alle an Bord“).
- **Dokumentfotos** (Pass, Ausweis, Versicherungskarte): nur auf dem Gerät, für alle Reisen.

Alles funktioniert offline. Nummern ändern sich selten, aber kurz vor der Abreise lohnt ein Blick in die App „Sicher Reisen“ des Auswärtigen Amts.

## 8. Zu Fuß: Spaziergänge und Navi

Im Tab **Zu Fuß** plant man Spaziergänge mit bis zu 25 Punkten und lässt sich hinführen.

- **Punkte hinzufügen:** suchen (Orte, Adressen, Sehenswürdigkeiten), „📍 Meine Position“, „＋ Auf Karte antippen“ oder „★ Sehenswürdigkeiten übernehmen“ – das liest die Sehenswürdigkeiten und Ausflüge der gewählten Station aus der Reiseplanung und sucht sie in deren Nähe (bitte prüfen). „⇅ Reihenfolge optimieren“ sortiert nach kürzestem Weg, der erste Punkt bleibt Start. „Rundweg“ führt zurück zum Start.
- **Weg:** wird automatisch berechnet (Strecke, Gehzeit, Abschnitte, Wegbeschreibung) und auf diesem Gerät gespeichert – er bleibt ohne Netz verfügbar. „GPX“ exportiert ihn für andere Apps.
- **Navigation starten:** Vollbild mit Live-Position, nächstem Abbiegehinweis und Entfernung, Restweg mit Ankunftszeit, Sprachansagen (abschaltbar), Vibration (Android). Wer vom Weg abkommt, bekommt online automatisch einen neuen Weg. Die Karte dreht sich auf Wunsch in Blickrichtung (🧭). Der Bildschirm bleibt während der Navigation an. Ist „Navigation startet an meiner Position“ an, führt die App zuerst von dort zum ersten Punkt.
- **Zu Fuß dorthin:** In „Meine Route“ hat jede Station diesen Knopf – mit Reiseatelier navigieren oder in Google Maps, Apple Karten bzw. einer anderen Navi-App öffnen.
- **Grenzen:** Das iPhone verfolgt die Position einer Web-App nicht weiter, wenn der Bildschirm gesperrt ist – während der Navigation das Display anlassen. Keine Echtzeitdaten für Bus und Bahn; dafür Google Maps oder Apple Karten öffnen.
- **Routing-Dienst:** Standard ist der ehrenamtlich betriebene FOSSGIS-Routingserver (OSRM, ohne Anmeldung, höchstens eine Anfrage pro Sekunde, keine Verfügbarkeitsgarantie). Alternativ openrouteservice mit eigenem kostenlosem Schlüssel (2.000 Wege pro Tag), unter „Einstellungen fürs Navi“. Der Schlüssel bleibt auf dem Gerät. Die Ortssuche nutzt Photon (komoot). Punkte und Suchbegriffe gehen dabei an den jeweiligen Dienst.
- **Abgleich:** Spaziergänge (Name, Station, Punkte) werden mit der Reise abgeglichen. Berechnete Wege und Kartenpakete bleiben auf dem jeweiligen Gerät.

### Offline-Karten

Ein Kartenpaket enthält eine Stadt mit allen Straßen, Wegen und Namen (Vektorkarte aus OpenStreetMap, aufbereitet von Protomaps). Unten im Tab „Zu Fuß“ → „🗺 Offline-Karten“ → „⬇ Laden“, am besten im WLAN. Pakete, die zur Reise passen, sind markiert. Danach zeigt der Tab die Karte ohne Internet; zusammen mit vorher berechneten Wegen funktioniert auch die Navigation. Neue Wege lassen sich offline nicht berechnen – also vor der Reise oder im Hotel-WLAN planen.

**Welche Städte es gibt** steht in `maps/packs.json` (Name, Land, Rahmen `[West, Süd, Ost, Nord]`). Eine Stadt ergänzen: Eintrag hinzufügen (Rahmen z. B. mit bboxfinder.com bestimmen), committen – die Action baut die Pakete neu und schreibt `maps/catalog.json`. Sie holt dazu den aktuellen Planet-Build von build.protomaps.com und schneidet die Städte mit dem `pmtiles`-Programm aus; am 2. jedes Monats aktualisiert sie die Karten. Jedes Paket hat etwa 5–40 MB, GitHub Pages erlaubt zusammen 1 GB. Eigene Pakete (z. B. mit `pmtiles extract` erstellt) lassen sich über „Kartenpaket aus Datei laden“ übernehmen. Die normalen Kacheln von openstreetmap.org werden nicht vorab geladen – das verbieten deren Nutzungsbedingungen.

## 9. Packliste

Im Tab „Packliste“ erzeugt die App eine Liste aus Vorlagen, passend zur Art der Reise, zur Dauer (z. B. Anzahl Unterwäsche/T-Shirts) und zu den Zielen: Fernreise, Reiseadapter (Länder mit anderen Steckdosen), Strand, Tropen, Kälte, Wandern, Kreuzfahrt, Auto, Städtereise. Vorlagen lassen sich später ergänzen, ohne dass Einträge doppelt kommen. Eigene Einträge mit Kategorie, Anzahl und Person; Filter nach Person, „Gepacktes ausblenden“ und „Alle Haken entfernen“ für die Rückreise. Personen kommen aus „Einreise → Reisende eintragen“.

## 10. Reisekasse

Ausgaben in beliebiger Währung eintragen: Betrag, Kategorie, Datum, Station, wer bezahlt hat und auf wen es aufgeteilt wird. Die App rechnet in Euro um und speichert den Kurs mit der Ausgabe – spätere Kursänderungen verändern alte Ausgaben also nicht. Kurse kommen online von der freien Frankfurter-API (Referenzkurse von Zentralbanken) und gelten dann auch offline; jeder Kurs lässt sich von Hand ändern, z. B. auf den Kurs der Kreditkartenabrechnung. Übersicht: Summe, optionales Budget mit Rest und Tagesschnitt, Aufteilung nach Kategorien, wer wie viel bezahlt hat und wer wem was überweisen muss. Geplante Ausflugskosten aus der Reiseplanung werden zusätzlich angezeigt.

Packliste und Reisekasse laufen über dieselbe Abgleich-Datei und werden Eintrag für Eintrag zusammengeführt: Haken oder Ausgaben, die zwei Personen gleichzeitig eintragen, gehen nicht verloren.

## 11. Sprache und Darstellung

Deutsch oder Englisch, unter Einstellungen → „Sprache / Language“. Darunter „Darstellung“: Automatisch (folgt dem hellen/dunklen Modus des Geräts), Hell oder Dunkel. Die Einstellung gilt pro Gerät; beim ersten Start richtet sie sich nach der Sprache des Browsers. Eigene Einträge (Notizen, Tagebuch, Ortsnamen) werden nicht übersetzt.

## 12. Unterwegs ohne Internet

Route, Planung, Einreise, Notfall, Tagebuch, Fotos, Ortssuche (eingebaute Liste mit rund 49.000 Orten) und eine Weltkarte mit Länderumrissen funktionieren offline. Online kommen die Detailkarte (OpenStreetMap), die genauere Ortssuche und Länder- und Klimadaten dazu. Mit Offline-Kartenpaket funktionieren im Tab „Zu Fuß“ auch Stadtkarte und gespeicherte Wege ohne Netz.

## 13. Aktualisieren

Wer `style.css` ändert, erzeugt das dunkle Farbschema neu mit `python3 tools/make-dark-css.py` (Handkorrekturen in `tools/dark-extra.css`).


Neue Dateien über die alten hochladen. Die Reisedaten bleiben auf den Geräten. Beim nächsten Öffnen mit Internet lädt die App die neue Version.

## Quellen

Kartendaten © OpenStreetMap-Mitwirkende (ODbL), Natural Earth; Kartenpakete aufbereitet von Protomaps. Kartenbibliotheken Leaflet 1.9.4 (BSD-2-Clause), MapLibre GL JS 5 und PMTiles (BSD-3-Clause), Kartenstil @protomaps/basemaps (BSD-3-Clause), Schrift Noto Sans (SIL OFL) – Details in `vendor/LICENSE-kartenbausteine.txt`. Fußwege: FOSSGIS-Routingserver (OSRM) bzw. openrouteservice (HeiGIT). Ortssuche: Photon (komoot). Ortsliste GeoNames (CC BY 4.0). Notrufnummern: u. a. Wikipedia „List of emergency telephone numbers“. Vertretungen und Reisehinweise: Auswärtiges Amt.
