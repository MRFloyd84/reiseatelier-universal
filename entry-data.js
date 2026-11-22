'use strict';
/* Einreise-Checkliste für deutsche Staatsangehörige.
   GENERAL: gilt für jede Reise (due = spätestens so viele Tage vor Reisebeginn; types = nur für diese Reisetypen).
   TASKS: Formalitäten einzelner Länder, recherchiert am 18.11.2026 (GB, US, AU, ID, SG, MY, LK, MV, SC, CV) bzw. 22.11.2026 (CA, NZ, TH)
   auf den offiziellen Seiten der Länder. open = frühestens so viele Tage vor Ankunft, due = spätestens so viele Tage vor Ankunft.
   places = Aufgabe nur, wenn eine Station in diesem Ort/Gebiet liegt.
   Für Länder ohne hinterlegte Aufgabe erzeugt die App „Einreisebestimmungen prüfen“ mit Link zum Auswärtigen Amt. */
(function(root){
const CHECKED='22.11.2026';
const AA='https://www.auswaertiges-amt.de/de/reiseundsicherheit/reise-und-sicherheitshinweise/uebersicht-navi';
const GENERAL=[
 {id:'pass',title:'Reisepass oder Personalausweis prüfen',detail:'Viele Länder verlangen, dass der Pass noch mindestens 6 Monate über das Reiseende hinaus gültig ist und freie Seiten hat. In der EU und einigen Nachbarländern genügt der Personalausweis. Ein neuer Pass braucht mehrere Wochen – und elektronische Einreisegenehmigungen (z. B. ESTA, UK ETA) gelten nur für den Pass, mit dem sie beantragt wurden.',due:90},
 {id:'versicherung',title:'Auslandskrankenversicherung prüfen',detail:'Prüft, ob die ganze Reisedauer inklusive Rücktransport abgedeckt ist. Viele Jahresverträge gelten nur 6–8 Wochen am Stück. Versicherung und Notrufnummer im Tab „Notfall“ eintragen.',due:30},
 {id:'reisemedizin',title:'Reisemedizinische Beratung',detail:'Für Fernreisen 6–8 Wochen vorher Impfungen und Malariaschutz klären (Hausarzt, Tropeninstitut oder Gesundheitsamt). Den Impfpass mitnehmen.',due:42},
 {id:'unterlagen',title:'Hinweise des Reiseveranstalters lesen',detail:'Bei Pauschalreisen und Kreuzfahrten steht in den Reiseunterlagen, welche Genehmigungen ihr selbst beantragen müsst und was der Veranstalter übernimmt. Diese Angaben gehen vor.',due:30,types:['kreuzfahrt','badeurlaub']},
 {id:'fuehrerschein',title:'Führerschein: international nötig?',detail:'Außerhalb der EU verlangen viele Länder oder Mietwagenfirmen zusätzlich einen Internationalen Führerschein. Den gibt es bei der Führerscheinstelle.',due:30,types:['rundreise']},
 {id:'elefand',title:'Krisenvorsorgeliste „ELEFAND“',detail:'Beim Auswärtigen Amt kostenlos eintragen, damit die Botschaften euch im Krisenfall erreichen. Dazu die App „Sicher Reisen“.',due:7,link:'https://krisenvorsorgeliste.diplo.de',abroad:true},
];
const TASKS=[
 {id:'uk-eta',cc:'GB',title:'UK ETA beantragen',detail:'Elektronische Einreisegenehmigung für Großbritannien, auch bei Ankunft per Schiff oder Fähre. Gilt 2 Jahre bzw. bis zum Ablauf des Passes. Antrag über die App „UK ETA“ oder online, Entscheidung meist innerhalb von 3 Werktagen.',cost:'20 £ pro Person',link:'https://www.gov.uk/eta',open:700,due:14},
 {id:'esta',cc:'US',title:'ESTA beantragen',detail:'Pflicht für die Einreise per Flugzeug oder Schiff in die USA. Gilt 2 Jahre bzw. bis zum Ablauf des Passes. Nur auf der offiziellen Seite beantragen – andere Seiten verlangen Aufschläge. Wer seit 2021 in Kuba war, bekommt kein ESTA, sondern braucht ein Visum.',cost:'40,62 $ pro Person',link:'https://esta.cbp.dhs.gov',open:700,due:21},
 {id:'ca-eta',cc:'CA',title:'Kanada: eTA beantragen (bei Anreise per Flugzeug)',detail:'Für die Einreise oder den Umstieg per Flugzeug nötig. Bei Ankunft auf dem Landweg oder per Schiff entfällt die eTA. Gilt bis zu 5 Jahre bzw. bis zum Ablauf des Passes, meist in Minuten genehmigt.',cost:'7 CAD pro Person',link:'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html',open:700,due:7},
 {id:'evisitor',cc:'AU',title:'Australien: eVisitor (Subclass 651)',detail:'Kostenloses elektronisches Visum für EU-Bürger, über ein ImmiAccount beantragen. Gilt 12 Monate ab Erteilung – nicht zu früh beantragen, damit es bis zur Ausreise gilt. Bei der Ankunft kommt die Einreisekarte (Incoming Passenger Card) dazu.',cost:'kostenlos',link:'https://immi.homeaffairs.gov.au',open:330,due:30},
 {id:'nzeta',cc:'NZ',title:'Neuseeland: NZeTA beantragen',detail:'Elektronische Einreisegenehmigung, auch für Kreuzfahrtgäste. Zusammen mit der NZeTA wird die Touristenabgabe IVL bezahlt. Gilt 2 Jahre. Am günstigsten über die offizielle App „NZeTA“, Bearbeitung bis zu 72 Stunden.',cost:'17 NZD (App) bzw. 23 NZD (Web) plus 100 NZD IVL',link:'https://www.immigration.govt.nz/new-zealand-visas/visas/visa/nzeta',open:700,due:7},
 {id:'id-evoa',cc:'ID',title:'Indonesien: Visum (e-VOA)',detail:'Deutsche brauchen ein Visum. Das e-VOA wird vorab online beantragt. Ein Visum bei Ankunft gibt es nicht an jedem Flug- und Seehafen – also besser vorher beantragen, nur wenige Wochen vor der Ankunft.',cost:'kostenpflichtig',link:'https://evisa.imigrasi.go.id',open:60,due:7},
 {id:'id-card',cc:'ID',title:'Indonesien: Einreisekarte „All Indonesia“',detail:'Digitale Einreise- und Zollerklärung, innerhalb von 3 Tagen vor Ankunft ausfüllen.',cost:'kostenlos',open:3,due:0},
 {id:'bali-levy',cc:'ID',title:'Bali: Tourismusabgabe',detail:'Abgabe für ausländische Besucher auf Bali, online über die offizielle Seite „Love Bali“ oder vor Ort zahlbar.',cost:'150.000 IDR (ca. 9 €)',link:'https://lovebali.baliprov.go.id',open:30,due:0,places:['bali','denpasar','benoa','ubud','kuta','seminyak','sanur','canggu','nusa dua','jimbaran','uluwatu','lovina','amed']},
 {id:'th-tdac',cc:'TH',title:'Thailand: Digital Arrival Card (TDAC)',detail:'Kostenlose digitale Einreisekarte für alle Ausländer, egal ob per Flugzeug, Land oder Schiff. Frühestens 3 Tage vor Ankunft ausfüllen. Nur über die offizielle Seite – andere Seiten verlangen Gebühren.',cost:'kostenlos',link:'https://tdac.immigration.go.th',open:3,due:0},
 {id:'sgac',cc:'SG',title:'Singapur: SG Arrival Card',detail:'Kostenlose Einreisekarte mit Gesundheitserklärung, innerhalb von 3 Tagen vor Ankunft ausfüllen – auch bei Ankunft per Schiff. Nur über die offizielle ICA-Seite oder die App „MyICA“.',cost:'kostenlos',link:'https://eservices.ica.gov.sg/sgarrivalcard',open:3,due:0},
 {id:'mdac',cc:'MY',title:'Malaysia: Digital Arrival Card (MDAC)',detail:'Kostenlose digitale Einreisekarte, innerhalb von 3 Tagen vor Ankunft.',cost:'kostenlos',link:'https://imigresen-online.imi.gov.my/mdac/main',open:3,due:0},
 {id:'lk-eta',cc:'LK',title:'Sri Lanka: ETA beantragen',detail:'Für Deutsche seit 25.05.2026 kostenlos, muss aber vorher beantragt werden. Frühestens 90 Tage vor Ankunft möglich. Bei bis zu 2 Tagen im Land reicht ggf. die Transit-ETA. Bestätigung ausdrucken oder aufs Handy laden.',cost:'kostenlos',link:'https://eta.gov.lk/slvisa/',open:90,due:7},
 {id:'imuga',cc:'MV',title:'Malediven: IMUGA Traveller Declaration',detail:'Pflichtformular für jede Einreise, innerhalb von 96 Stunden vor Ankunft. Das Visum selbst gibt es kostenlos bei Ankunft.',cost:'kostenlos',link:'https://imuga.immigration.gov.mv/traveller',open:4,due:0},
 {id:'sc-ta',cc:'SC',title:'Seychellen: Travel Authorisation',detail:'Pflicht für alle Besucher, seit Dezember 2024 auch für Kreuzfahrtgäste. Frühestens 30 Tage vor Ankunft beantragen. Nur über die offizielle Regierungsseite.',cost:'ca. 12 € pro Person',link:'https://seychelles.govtas.com',open:30,due:1},
 {id:'cv-ease',cc:'CV',title:'Kap Verde: EASE-Vorregistrierung',detail:'Online-Vorregistrierung, ggf. mit Sicherheitsgebühr, spätestens 5 Tage vor Ankunft. Bei Kreuzfahrten kann die Reederei das übernehmen – siehe Reiseunterlagen.',cost:'je nach Fall',link:'https://www.ease.gov.cv',open:30,due:5},
];
/* EU, EWR und Schweiz: Freizügigkeit, Personalausweis genügt. Französische Überseedepartements gehören zur EU. */
const EU='AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH AX GF GP MQ RE YT MF'.split(' ');
const FREE={};for(const cc of EU)FREE[cc]='EU/EWR – Personalausweis oder Reisepass genügt, kein Visum.';
root.EntryData={CHECKED,AA,GENERAL,TASKS,FREE};
})(globalThis);
