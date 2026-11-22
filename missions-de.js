'use strict';
/* Heimatland Deutschland: zentrale Nummern und deutsche Auslandsvertretungen.
   Vertretungen: recherchiert für einen Teil der Länder auf auswaertiges-amt.de bzw. diplo.de (Stand 18.11.2026).
   Für alle anderen Länder verweist die App auf die Seiten des Auswärtigen Amts.
   cities = Orte, für die eine Vertretung zuständig ist (zur Hervorhebung passend zur Station). */
(function(root){
const CHECKED='18.11.2026';
const CENTRAL=[
  {label:'Auswärtiges Amt – Notfälle rund um die Uhr',phone:'+49 30 5000 0',note:'Telefonzentrale in Berlin, rund um die Uhr besetzt, auch für Notfälle im Ausland.'},
  {label:'Sperr-Notruf für Bank- und Kreditkarten',phone:'+49 116 116',alt:'+49 30 4050 4050',note:'Falls 116 116 aus dem Ausland nicht klappt, die Berliner Ersatznummer wählen.'},
  {label:'Giftnotruf Berlin (24 h)',phone:'+49 30 19240'},
];
const LINKS=[
  {label:'Reise- und Sicherheitshinweise aller Länder',url:'https://www.auswaertiges-amt.de/de/reiseundsicherheit/reise-und-sicherheitshinweise/uebersicht-navi'},
  {label:'Krisenvorsorgeliste ELEFAND',url:'https://krisenvorsorgeliste.diplo.de'},
];
const C=[
 {cc:'GB',missions:[{name:'Deutsche Botschaft London',phone:'+44 20 7824 1300',emergency:'+44 7956 626107'}]},
 {cc:'CA',missions:[{name:'Generalkonsulat Toronto (zuständig für ganz Kanada)',phone:'+1 416 925 2813',emergency:'+1 416 953 3817'},{name:'Honorarkonsulin Halifax',phone:'+1 902 420 1599',cities:['Halifax'],note:'Nur nach Terminvereinbarung, für Notfälle Generalkonsulat Toronto.'}]},
 {cc:'US',missions:[
   {name:'Generalkonsulat Boston',phone:'+1 617 369 4900',emergency:'+1 202 298 4000',cities:['Boston']},
   {name:'Generalkonsulat New York',phone:'+1 212 610 9700',emergency:'+1 202 298 4000',cities:['New York']},
   {name:'Generalkonsulat Miami (Florida)',phone:'+1 305 358 0290',emergency:'+1 202 298 4000',cities:['Miami','Port Canaveral']},
   {name:'Generalkonsulat Los Angeles (Südkalifornien)',phone:'+1 323 930 2703',emergency:'+1 202 298 4000',cities:['Los Angeles','San Diego','Santa Barbara']},
   {name:'Generalkonsulat San Francisco (Nordkalifornien, Hawaii)',phone:'+1 415 775 1061',emergency:'+1 202 298 4000',cities:['San Francisco','Honolulu','Kahului','Hilo','Kailua-Kona']},
   {name:'Honorarkonsul Honolulu (Hawaii)',phone:'+1 808 377 4606',cities:['Honolulu','Kahului','Hilo','Kailua-Kona']}],
   note:'Die Notfallnummer +1 202 298 4000 ist der zentrale Bereitschaftsdienst aller deutschen Vertretungen in den USA.'},
 {cc:'MX',missions:[{name:'Deutsche Botschaft Mexiko-Stadt',phone:'+52 55 5283 2200',emergency:'+52 55 5431 2177'},{name:'Honorarkonsulin Cancún (Quintana Roo, auch Cozumel)',phone:'+52 998 884 1598',cities:['Cozumel']}]},
 {cc:'BZ',missions:[{name:'Honorarkonsulin Belize City',phone:'+501 223 0896',cities:['Belize City']},{name:'Deutsche Botschaft Guatemala (zuständig für Belize)',phone:'+502 2364 6700',emergency:'+502 5709 5004'}]},
 {cc:'HN',missions:[{name:'Honorarkonsul San Pedro Sula (zuständig für die Bay Islands/Roatán)',phone:'+504 2550 2002',cities:['Roatán']},{name:'Deutsche Botschaft Tegucigalpa',phone:'+504 2275 9292',emergency:'+504 9990 2437'}]},
 {cc:'CR',missions:[{name:'Deutsche Botschaft San José',phone:'+506 2290 9091',emergency:'+506 8381 7968'}]},
 {cc:'PA',missions:[{name:'Deutsche Botschaft Panama-Stadt',phone:'+507 307 6300',emergency:'+507 6517 3200',note:'Bereitschaftsdienst bis 24 Uhr Ortszeit, auch per SMS/WhatsApp.'}]},
 {cc:'GT',missions:[{name:'Deutsche Botschaft Guatemala-Stadt',phone:'+502 2364 6700',emergency:'+502 5709 5004',note:'Notfallnummer auch per SMS.'}]},
 {cc:'PF',missions:[{name:'Deutsche Botschaft Paris (zuständig)',phone:'+33 1 53 83 45 00',emergency:'+33 6 11 76 22 55'},{name:'Deutsche Botschaft Wellington (Passangelegenheiten)',phone:'+64 4 473 6063',emergency:'+64 21 651 987'}]},
 {cc:'CK',missions:[{name:'Deutsche Botschaft Wellington (zuständig)',phone:'+64 4 473 6063',emergency:'+64 21 651 987',note:'Notfallnummer auch per SMS.'}]},
 {cc:'NC',missions:[{name:'Deutsche Botschaft Paris (zuständig)',phone:'+33 1 53 83 45 00',emergency:'+33 6 11 76 22 55'}]},
 {cc:'AU',missions:[{name:'Generalkonsulat Sydney (u. a. NSW, Queensland, Northern Territory)',phone:'+61 2 8302 4900',emergency:'+61 412 359 826',note:'Australienweite Rufbereitschaft, auch per SMS.'}]},
 {cc:'ID',missions:[{name:'Honorarkonsul Bali (Sanur, zuständig für Bali und Lombok)',phone:'+62 361 288 535',cities:['Benoa','Lembar']},{name:'Deutsche Botschaft Jakarta',phone:'+62 21 3985 5000',emergency:'+62 811 152 526'}]},
 {cc:'SG',missions:[{name:'Deutsche Botschaft Singapur',phone:'+65 6533 6002',emergency:'+65 9817 0414',note:'Notfallnummer werktags nach Dienstschluss bis 24 Uhr, am Wochenende tagsüber.'}]},
 {cc:'MY',missions:[{name:'Honorarkonsul Penang',phone:'+60 4 263 2566',cities:['George Town']},{name:'Deutsche Botschaft Kuala Lumpur',phone:'+60 3 2170 9666',emergency:'+60 12 326 9070',note:'Bereitschaft bis 24 Uhr, am Wochenende 8–24 Uhr.'}]},
 {cc:'LK',missions:[{name:'Deutsche Botschaft Colombo',phone:'+94 11 258 0431',emergency:'+94 77 734 4283',note:'Notfallnummer Mo–Fr 15:30–22 Uhr, Wochenende 8–22 Uhr.'}]},
 {cc:'MV',missions:[{name:'Honorarkonsul Malé',phone:'+960 334 9595'},{name:'Deutsche Botschaft Colombo (zuständig)',phone:'+94 11 258 0431',emergency:'+94 77 734 4283'}]},
 {cc:'SC',missions:[{name:'Honorarkonsulin Victoria (Mahé)',phone:'+248 4601 100',emergency:'+248 2718 350'},{name:'Deutsche Botschaft Nairobi (zuständig)',emergency:'+254 721 322 443',note:'Notfallnummer auch per SMS/WhatsApp.'}]},
 {cc:'MU',missions:[{name:'Honorarkonsul Ébène',phone:'+230 5253 0300'},{name:'Deutsche Botschaft Antananarivo (zuständig)',phone:'+261 20 222 3802',emergency:'+261 37 03 457 39'}]},
 {cc:'RE',missions:[{name:'Deutsche Botschaft Paris (zuständig)',phone:'+33 1 53 83 45 00',emergency:'+33 6 11 76 22 55'}]},
 {cc:'ZA',missions:[{name:'Generalkonsulat Kapstadt (West- und Ostkap)',phone:'+27 21 405 3000'},{name:'Deutsche Botschaft Pretoria',phone:'+27 12 427 8900'}],note:'Eine eigene Bereitschaftsnummer war nicht angegeben – außerhalb der Dienstzeit das Auswärtige Amt anrufen (+49 30 5000 0).'},
 {cc:'BR',missions:[
   {name:'Generalkonsulat São Paulo (auch Santos)',phone:'+55 11 3097 6644',emergency:'+55 61 3442 7000',cities:['Santos']},
   {name:'Generalkonsulat Rio de Janeiro (auch Angra dos Reis, Búzios)',phone:'+55 21 3380 3700',emergency:'+55 61 3442 7000',cities:['Rio de Janeiro','Angra dos Reis','Búzios']},
   {name:'Generalkonsulat Recife (zuständig für Bahia/Salvador)',phone:'+55 81 3463 5350',emergency:'+55 61 3442 7000',cities:['Salvador']}],
   note:'+55 61 3442 7000 ist die Bereitschaftsnummer der deutschen Vertretungen in Brasilien.'},
 {cc:'CV',missions:[{name:'Honorarkonsul Mindelo',phone:'+238 231 2725'},{name:'Deutsche Botschaft Lissabon (zuständig)',phone:'+351 21 881 0210',emergency:'+351 96 580 8092'}],note:'Bei Passverlust stellt die Botschaft Portugals in Praia ein EU-Notreisedokument aus.'},
 {cc:'ES',missions:[{name:'Honorarkonsul Teneriffa (Puerto de la Cruz)',phone:'+34 922 248 820'},{name:'Deutsches Konsulat Las Palmas (Kanaren)',phone:'+34 928 491 880',emergency:'+34 91 557 9000'}]},
 {cc:'PT',missions:[{name:'Deutsche Botschaft Lissabon (auch Madeira)',phone:'+351 21 881 0210',emergency:'+351 96 580 8092',note:'Bereitschaft werktags abends bis 24 Uhr, am Wochenende 8–24 Uhr.'}]},
];
root.HomeCountry={DE:{name:'Deutschland',CHECKED,CENTRAL,LINKS,MISSIONS:Object.fromEntries(C.map(c=>[c.cc,c]))}};
})(globalThis);
