'use strict';
/* Startseite: Reise-Banner mit Fortschritt, nächste Stationen, letzte Tagebucheinträge, Bereichskarten. */
(function(){
const q=s=>document.querySelector(s);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trip=()=>{try{return state;}catch{return {settings:{},destinations:[]};}};
const DAY=86400000;
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const de=(d,o)=>new Date(d+'T12:00:00').toLocaleDateString('de-DE',o||{day:'2-digit',month:'2-digit',year:'numeric'});
const fl=c=>{try{return flag(c);}catch{return '';}};
const cn=c=>{try{return countryNames.of(c);}catch{return c;}};
let diary={count:0,photos:0,latest:[]},diaryLoaded=false;

function sorted(){return trip().destinations.filter(d=>d.start).slice().sort((a,b)=>(a.start+(a.arrival||'')).localeCompare(b.start+(b.arrival||'')));}
function banner(){const ds=sorted(),s=trip().settings||{};
  if(!ds.length)return `<section class="home-banner"><div><div class="hb-eyebrow">NOCH KEINE ROUTE</div><h2>Plant eure nächste Reise</h2><p>Gebt der Reise unter Einstellungen einen Namen und tragt die erste Station ein. Weitere Reisen legt ihr oben über den Reisenamen an.</p><div class="button-row"><button class="primary" data-action="new">＋ Reiseziel hinzufügen</button><a class="secondary hb-light btn-link" href="#einstellungen">⚙ Reise einrichten</a></div></div></section>`;
  const first=ds[0],last=ds.reduce((a,b)=>(b.end||b.start)>(a.end||a.start)?b:a),start=first.start,end=last.end||last.start,today=iso(new Date());
  const total=Math.round((Date.parse(end)-Date.parse(start))/DAY)+1;let pct=0,state;
  if(today<start){const n=Math.ceil((Date.parse(start)-Date.parse(today))/DAY);state=`Noch <b>${n}</b> ${n===1?'Tag':'Tage'} bis zur Abreise`;}
  else if(today<=end){const n=Math.round((Date.parse(today)-Date.parse(start))/DAY)+1;pct=Math.round(n/total*100);state=`Reisetag <b>${n}</b> von ${total}`;}
  else{pct=100;state='Reise abgeschlossen';}
  const countries=new Set(ds.map(d=>d.country)).size;
  return `<section class="home-banner"><div class="hb-main"><div class="hb-eyebrow">EURE REISE</div><h2>${h(s.title||'Eure Reise')}</h2><p>${h(s.description||'')}</p><div class="hb-dates"><span>${h(de(start,{weekday:'short',day:'2-digit',month:'long',year:'numeric'}))}</span><span aria-hidden="true">→</span><span>${h(de(end,{weekday:'short',day:'2-digit',month:'long',year:'numeric'}))}</span></div>
  <div class="hb-progress" role="img" aria-label="Fortschritt ${pct} Prozent"><i style="width:${pct}%"></i></div><p class="hb-state">${state}</p></div>
  <dl class="hb-facts"><div><dt>Start</dt><dd>${h(first.city||first.name)}</dd></div><div><dt>Ziel</dt><dd>${h(last.city||last.name)}</dd></div><div><dt>Stationen</dt><dd>${ds.length}</dd></div><div><dt>Länder</dt><dd>${countries}</dd></div><div class="hb-wide"><dt>Reisetage</dt><dd>${total}</dd></div></dl></section>`;}
function nextStops(){const ds=sorted(),today=iso(new Date());if(!ds.length)return '';
  let up=ds.filter(d=>(d.end||d.start)>=today);const title=up.length&&up[0].start<=today?'Heute und als Nächstes':up.length===ds.length?'Die ersten Stationen':'Als Nächstes';if(!up.length)up=ds.slice(-3);
  return `<section class="panel home-next"><div class="home-panel-head"><h3>${title}</h3><a href="#route">Ganze Route ›</a></div><ol>${up.slice(0,4).map(d=>`<li><span class="hn-date"><b>${h(de(d.start,{day:'2-digit'}))}</b>${h(de(d.start,{month:'short'}))}</span><span class="hn-body"><strong>${fl(d.country)} ${h(d.name)}</strong><small>${h(cn(d.country))}${d.arrival?' · an '+h(d.arrival):''}${d.departure?' · ab '+h(d.departure):''}${TravelCore.aboard(d)?' · <b class="aboard-chip">an Bord '+h(TravelCore.aboard(d).time)+(TravelCore.aboard(d).estimated?' (ca.)':'')+'</b>':''}${d.end&&d.end!==d.start?' · bis '+h(de(d.end,{day:'2-digit',month:'2-digit'})):''}</small></span><span class="badge ${h(d.status)}">${h({offen:'offen',arbeit:'begonnen',fertig:'steht'}[d.status]||'')}</span></li>`).join('')}</ol></section>`;}
function latestDiary(){return `<section class="panel home-diary"><div class="home-panel-head"><h3>Aus dem Reisetagebuch</h3><a href="#tagebuch">Alle Einträge ›</a></div>${!diaryLoaded?'<p class="muted">Wird geladen …</p>':diary.latest.length?`<ul>${diary.latest.map(e=>`<li><a href="#tagebuch"><span class="hd-date">${h(de(e.date,{day:'2-digit',month:'short',year:'numeric'}))}</span><strong>${h(e.title||'Ohne Titel')}</strong>${e.text?`<small>${h(e.text.slice(0,110))}${e.text.length>110?' …':''}</small>`:''}</a></li>`).join('')}</ul>`:`<p class="muted">Noch keine Einträge. Unterwegs könnt ihr hier Erlebnisse, Stimmung und Fotos festhalten.</p><a class="secondary btn-link" href="#tagebuch">✎ Zum Tagebuch</a>`}</section>`;}
function cards(){const ds=trip().destinations,done=ds.filter(d=>d.status==='fertig').length,open=ds.filter(d=>d.status==='offen').length,pct=ds.length?Math.round(done/ds.length*100):0;
  const c=[['#route','⚑','Meine Route',ds.length?`${ds.length} Stationen in ${new Set(ds.map(d=>d.country)).size} Ländern auf der Karte`:'Stationen anlegen und auf der Karte verbinden'],
    ['#planung','▤','Meine Reiseplanung',ds.length?`${pct} % fertig geplant · ${open} Stationen noch offen`:'Ausflüge, Buchungen und Notizen je Station'],
    ['#zufuss','🚶','Zu Fuß',window.TravelWalk?.homeLine()||'Spaziergänge planen und navigieren'],
    ['#einreise','✈','Einreise','Visum, Einreiseformulare und Fristen für alle Reisenden'],
    ['#packliste','✓','Packliste',window.TravelPacking?.homeLine()||'Vorlage passend zu Reiseart und Zielen'],
    ['#reisekasse','€','Reisekasse',window.TravelBudget?.homeLine()||'Ausgaben, Budget und wer wem was schuldet'],
    ['#tagebuch','✎','Mein Reisetagebuch',diaryLoaded?`${diary.count} ${diary.count===1?'Eintrag':'Einträge'} · ${diary.photos} ${diary.photos===1?'Foto':'Fotos'}`:'Erlebnisse, Stimmung, Wetter und Fotos'],
    ['#einstellungen','⚙','Einstellungen','Reisename, Art der Reise, Abgleich und Sicherung']];
  return `<section class="home-cards">${c.map(([href,icon,title,text])=>`<a class="home-card" href="${href}"><span class="hc-icon" aria-hidden="true">${icon}</span><strong>${title}</strong><small>${h(text)}</small><span class="hc-go" aria-hidden="true">›</span></a>`).join('')}</section>`;}
function syncStrip(){let m='';try{m=TravelStore.mode;}catch{}if(m==='shared')return '';return `<section class="home-sync" id="home-sync"><div><strong>Abgleich per Datei</strong><span data-sync-status></span></div><div class="button-row"><button class="${TravelStore.sync.dirty()?'secondary':'primary'} small-btn" data-sync="load">⇧ Laden</button><button class="${TravelStore.sync.dirty()?'primary':'secondary'} small-btn" data-sync="save">⇩ Speichern</button><a class="small-link" href="#einstellungen">So geht's</a></div></section>`;}
let guideOpen=null;document.addEventListener('toggle',e=>{if(e.target.classList?.contains('home-guide'))guideOpen=e.target.open;},true);
function guide(){if(guideOpen===null){let seen=false;try{seen=localStorage.getItem('ra.guideSeen')==='1';localStorage.setItem('ra.guideSeen','1');}catch{}guideOpen=!seen;}let m='';try{m=TravelStore.mode;}catch{}
  const fileSync=m!=='shared';
  const items=[
    ['Als App installieren','Auf iPhone und iPad die App über „Zum Home-Bildschirm“ installieren und nur noch über das Symbol starten – Safari löscht sonst nach einer Woche ohne Nutzung die Daten. Auf Android und am Computer bietet der Browser „App installieren“ an.'],
    ...(fileSync?[
    ['Jedes Gerät hat seinen eigenen Stand','Alles wird sofort auf dem eigenen Gerät gespeichert, auch ohne Internet. Die Änderungen der anderen kommen erst mit „Laden“.'],
    ['Laden → Ändern → Speichern','Vorher „Laden“ und die Datei dieser Reise aus dem geteilten Ordner wählen. Danach „Speichern“ und die Datei wieder in den Ordner legen.'],
    ['Immer „Ersetzen“ wählen','Beim Speichern in den Ordner nicht „Beide behalten“ antippen, sonst liegen mehrere Dateien herum.'],
    ['Gleichzeitig arbeiten ist okay','Beim Laden werden beide Stände zusammengeführt. Nur wenn ihr beide denselben Eintrag geändert habt, bleibt die neuere Änderung.']]:[]),
    ['Mehrere Reisen','Oben auf den Reisenamen tippen: Reisen wechseln, neu anlegen, duplizieren oder löschen. Jede Reise hat ihre eigene Abgleich-Datei.'],
    ['Fotos','Fotos werden beim Hinzufügen verkleinert. Die Originale bleiben in eurer Fotos-App.'],
    ['Unterwegs ohne Internet','Route, Planung, Tagebuch, Fotos und alle Notrufnummern funktionieren auch offline.'+(fileSync?' Abgleichen am besten im WLAN.':'')],
    ['Falls mal was schiefgeht',fileSync?'App gelöscht oder neues Handy? App neu installieren und die Abgleich-Datei laden. Vor jedem Laden legt die App eine Sicherheitskopie an (Einstellungen).':'Vor jedem Import legt die App eine Sicherheitskopie an (Einstellungen).']];
  return `<details class="panel home-guide"${guideOpen?' open':''}><summary><span class="hc-icon" aria-hidden="true">i</span><span><strong>Wichtig zu wissen</strong><small>${items.length} Punkte, damit nichts verloren geht</small></span></summary><ol>${items.map(([t,x])=>`<li><strong>${t}</strong><span>${x}</span></li>`).join('')}</ol></details>`;}
function render(){const el=q('#start');if(!el||el.hidden)return;q('#home-content').innerHTML=syncStrip()+guide()+banner()+(window.TravelEntry?.homeStrip()||'')+(window.TravelEmergency?.homeStrip()||'')+`<div class="home-grid">${nextStops()}${latestDiary()}</div>`+(window.TravelExtras?.statsHtml()||'')+cards();window.TravelSync?.render();}
async function loadDiary(){try{const list=await TravelStore.diary.list();diary={count:list.length,photos:list.reduce((a,e)=>a+(e.photos||[]).length,0),latest:list.slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).slice(0,3)};}catch{diary={count:0,photos:0,latest:[]};}diaryLoaded=true;render();}
window.TravelHome={show(){render();loadDiary();window.TravelExtras?.refresh();},onTrip:render};
addEventListener('travel-sync-status',()=>{const el=q('#start');if(el&&!el.hidden)render();});
})();
