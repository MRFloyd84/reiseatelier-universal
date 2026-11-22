# Reiseatelier (universell) – Anleitung

Reiseplanung für jede Art von Reise: Route mit Karte, Reiseplanung, Einreise-Checkliste, Notfall mit Notrufnummern aller Länder, Reisetagebuch mit Fotos und Countdown. Mehrere Reisen pro Gerät. Kein Konto und kein Server mit Datenbank nötig: reine Dateien (HTML, CSS, JavaScript), die auf jedem Webspace mit HTTPS laufen. Die Daten bleiben auf den Geräten, Mitreisende gleichen über eine Datei in einem geteilten Ordner ab.

## 1. Online stellen (einmalig, ca. 10 Minuten)

HTTPS ist Pflicht, sonst funktionieren App-Installation und Offline-Modus nicht.

**GitHub Pages:** Neues öffentliches Repository anlegen (z. B. `reiseatelier-universal`), den **Inhalt** dieses Ordners hochladen (`index.html` muss oben liegen), dann Settings → Pages → „Deploy from a branch“ → `main`, `/ (root)`. Nach 1–2 Minuten ist die App unter `https://DEINNAME.github.io/reiseatelier-universal/` erreichbar.

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

## 5. Einreise (Staatsangehörigkeit Deutschland)

Der Tab „Einreise“ erzeugt die Checkliste aus der Route:

- **Allgemein:** Pass/Ausweis, Auslandskrankenversicherung, Reisemedizin, Krisenvorsorgeliste ELEFAND, je nach Reiseart Führerschein und Veranstalter-Unterlagen.
- **Hinterlegte Länder** mit Zeitfenster, Kosten und offiziellem Link (Stand 22.11.2026): UK ETA, ESTA (USA), eTA (Kanada), eVisitor (Australien), NZeTA (Neuseeland), Indonesien (e-VOA, Einreisekarte, Bali-Abgabe), Thailand (TDAC), Singapur, Malaysia, Sri Lanka, Malediven, Seychellen, Kap Verde.
- **EU/EWR/Schweiz:** „Keine Formalitäten nötig“.
- **Alle anderen Länder:** Aufgabe „Einreisebestimmungen prüfen“ (6 Wochen vor Ankunft) mit Link zum Auswärtigen Amt.
- **Eigene Aufgaben** mit Fälligkeitsdatum und Land, z. B. ein Visum, das ihr beim Auswärtigen Amt gefunden habt.

Bis zu 6 Reisende können getrennt abhaken. Ist etwas fällig, erscheint ein Hinweis auf der Startseite.

## 6. Notfall

- **Örtliche Notrufnummern für alle 249 Länder und Gebiete** – Polizei, Rettung, Feuerwehr bzw. allgemeiner Notruf, mit Hinweisen (z. B. Touristenpolizei). Gleiche Nummern werden zusammengefasst. Wo die Quellen uneinheitlich sind, steht ein Warnhinweis. Stand 22.11.2026.
- **Länder der Route** automatisch, dazu „Alle Länder nachschlagen“ für jedes Land.
- **Deutschland:** Auswärtiges Amt (24 h), Sperr-Notruf, Giftnotruf, Links zu Reise- und Sicherheitshinweisen und ELEFAND. Deutsche Vertretungen sind für 26 Länder hinterlegt (Stand 18.11.2026), für alle anderen verweist die App auf die Länderseiten des Auswärtigen Amts.
- **Eure Angaben:** Versicherung, Veranstalter/Reederei, Kontaktpersonen, Arzt, Medizinisches.
- **Taxi-Karte** in der Landessprache (mit Unterkunft und Adresse bzw. bei Kreuzfahrten mit Schiff, Hafen und „Alle an Bord“).
- **Dokumentfotos** (Pass, Ausweis, Versicherungskarte): nur auf dem Gerät, für alle Reisen.

Alles funktioniert offline. Nummern ändern sich selten, aber kurz vor der Abreise lohnt ein Blick in die App „Sicher Reisen“ des Auswärtigen Amts.

## 7. Unterwegs ohne Internet

Route, Planung, Einreise, Notfall, Tagebuch, Fotos, Ortssuche (eingebaute Liste mit rund 49.000 Orten) und eine Weltkarte mit Länderumrissen funktionieren offline. Online kommen die Detailkarte (OpenStreetMap), die genauere Ortssuche und Länder- und Klimadaten dazu.

## 8. Aktualisieren

Neue Dateien über die alten hochladen. Die Reisedaten bleiben auf den Geräten. Beim nächsten Öffnen mit Internet lädt die App die neue Version.

## Quellen

Kartendaten © OpenStreetMap-Mitwirkende, Natural Earth. Kartenbibliothek Leaflet 1.9.4 (BSD-2-Clause). Ortsliste GeoNames (CC BY 4.0). Notrufnummern: u. a. Wikipedia „List of emergency telephone numbers“. Vertretungen und Reisehinweise: Auswärtiges Amt.
