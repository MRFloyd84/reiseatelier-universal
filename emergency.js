'use strict';
/* Notfallkarte: örtliche Notrufe aller Länder, zentrale Nummern und Vertretungen des Heimatlands,
   eigene Angaben (Versicherung, Kontakte, Veranstalter) und Dokumentfotos – alles offline verfügbar. */
(function(){
const N=globalThis.EmergencyNumbers;
const q=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let names=null;try{names=new Intl.DisplayNames(['de'],{type:'region'});}catch{}
const cn=cc=>{try{return names?.of(cc)||cc;}catch{return cc;}};
const flag=cc=>/^[A-Z]{2}$/.test(cc)?String.fromCodePoint(...[...cc].map(c=>127397+c.charCodeAt(0))):'';
const telHref=p=>'tel:'+String(p).replace(/[^\d+*#]/g,'');
const tel=(p,cls='')=>p?`<a class="em-tel ${cls}" href="${h(telHref(p))}">${h(p)}</a>`:'';
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function trip(){try{return state;}catch{return {destinations:[],settings:{}};}}
const cruise=()=>trip().settings?.tripType==='kreuzfahrt';
const HC=()=>globalThis.HomeCountry?.[trip().settings?.home||'DE']||null;
function sortedStops(){return [...(trip().destinations||[])].sort((a,b)=>(a.start+(a.arrival||'')).localeCompare(b.start+(b.arrival||'')));}
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
// Heutige bzw. nächste Station
function current(){const ds=sortedStops(),today=iso(new Date());const d=ds.find(x=>(x.end||x.start)>=today);if(!d)return null;return {d,today:d.start<=today};}
function matches(m,d){if(!m.cities||!d)return false;const t=norm(d.city)+' '+norm(d.name);return m.cities.some(p=>t.includes(norm(p)));}
/* Vertretungen: zuerst live vom Auswärtigen Amt (zwischengespeichert), sonst die hinterlegten. */
function liveOf(cc){const L=(trip().settings?.home||'DE')==='DE'?globalThis.AAMissions?.forCountry(cc):null;if(!L||!L.length)return null;
  return L.map(m=>({name:m.title+(m.city&&!m.title.includes(m.city)?' '+m.city:''),phone:m.phone,emergency:m.emergency,cities:m.city?[m.city]:[],note:m.area?'Zuständig: '+(m.area.length>160?m.area.slice(0,160)+' …':m.area):'',honorary:/honorar/i.test(m.title)}));}
function missionsOf(cc,d){const live=liveOf(cc);const list=live||HC()?.MISSIONS?.[cc]?.missions||[];return [...list].sort((a,b)=>matches(b,d)-matches(a,d));}
function aaStatusHtml(){const A=globalThis.AAMissions;if(!A||(trip().settings?.home||'DE')!=='DE')return '';const st=A.status();
  const when=st.fetched?new Date(st.fetched).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
  const err={offline:'gerade offline',blocked:'vom Browser blockiert',timeout:'keine Antwort'}[st.error]||(st.error?'Fehler: '+st.error:'');
  return `<p class="small em-aa">${st.fetched?`Deutsche Vertretungen: live vom Auswärtigen Amt, abgerufen am ${h(when)} (${st.count} Einträge).`:'Deutsche Vertretungen: hinterlegte Angaben für 26 Länder.'}${err?` Live-Abruf ${h(err)}${st.fetched?' – es gilt der zuletzt abgerufene Stand.':'.'}`:''} <button type="button" class="text-btn small-btn" id="aa-refresh">↻ Aktualisieren</button></p>`;}

/* Örtliche Nummern: gleiche Nummern zusammenfassen (z. B. „Notruf · Rettung · Feuerwehr 112“). */
function numberRows(cc){const x=N?.get(cc);if(!x)return [];const rows=[];
  for(const [label,num] of [['Notruf',x.general],['Polizei',x.police],['Rettung',x.ambulance],['Feuerwehr',x.fire]]){if(!num)continue;const r=rows.find(r=>r.num===num);if(r)r.labels.push(label);else rows.push({num,labels:[label]});}
  return rows;}
function numbersHtml(cc,big=false){const x=N?.get(cc);if(!x)return '<p class="small">Für dieses Gebiet sind keine Nummern hinterlegt.</p>';const rows=numberRows(cc);
  return `${rows.length?`<div class="em-nums-grid${big?' big':''}">${rows.map((r,i)=>`<a class="em-sosbtn${i?' alt':''}${big?' big':''}" href="${h(telHref(r.num))}"><span>${h(r.labels.join(' · '))}</span><b>☎ ${h(r.num)}</b></a>`).join('')}</div>`:''}
  ${x.note?`<p class="em-note">${h(x.note)}</p>`:''}${x.uncertain?'<p class="em-warn">⚠ Die Quellen sind für dieses Land uneinheitlich. Nummern vor Ort bestätigen lassen (Unterkunft, Reiseleitung, Botschaft).</p>':''}`;}
function missionHtml(m,d){const hit=matches(m,d);return `<li class="em-mission${hit?' em-hit':''}"><strong>${h(m.name)}</strong>${hit?'<span class="em-badge">für diesen Ort</span>':''}<span class="em-nums">${m.phone?`<span>Zentrale ${tel(m.phone)}</span>`:''}${m.emergency?`<span>Notfall ${tel(m.emergency,'em-red')}</span>`:''}</span>${m.note?`<small>${h(m.note)}</small>`:''}</li>`;}
function missionsBlock(cc,d){const hc=HC();if(!hc||cc===(trip().settings?.home||'DE'))return '';const live=!!liveOf(cc),ms=missionsOf(cc,d),note=live?'':HC().MISSIONS?.[cc]?.note;
  if(ms.length){const main=ms.filter((m,i)=>!m.honorary||matches(m,d)||i<3).slice(0,8),rest=ms.filter(m=>!main.includes(m));const st=globalThis.AAMissions?.status();
    return `<h4>Deutsche Vertretungen</h4><ul class="em-missions">${main.map(m=>missionHtml(m,d)).join('')}</ul>${rest.length?`<details class="em-more"><summary>${rest.length} weitere (Honorarkonsuln)</summary><ul class="em-missions">${rest.map(m=>missionHtml(m,d)).join('')}</ul></details>`:''}${note?`<p class="small">${h(note)}</p>`:''}<p class="small muted">${live?`Quelle: Auswärtiges Amt (OpenData), abgerufen am ${h(new Date(st.fetched).toLocaleDateString('de-DE'))}.`:`Stand ${h(hc.CHECKED)} – vor der Reise auf auswaertiges-amt.de prüfen.`}</p>`;}
  return `<h4>Deutsche Vertretung</h4><p class="small">Für ${h(cn(cc))} ist keine Vertretung hinterlegt. Zuständige Botschaft und Notfallnummer stehen auf der Länderseite des Auswärtigen Amts (Abschnitt „Kontakt“ bzw. „Deutsche Vertretungen“). Tipp: als eigene Notfallnummer bei „Eure Angaben“ eintragen.</p><p class="button-row"><a class="btn-link small-btn" href="${h(hc.LINKS[0].url)}" target="_blank" rel="noopener">Länderseiten des Auswärtigen Amts ↗</a></p><p class="small muted">Gibt es im Land keine deutsche Vertretung, hilft jede Botschaft eines anderen EU-Staats.</p>`;}
const stayLabels=()=>cruise()?{agent:'Hafenagent',berth:'Liegeplatz'}:{agent:'Unterkunft',berth:'Adresse'};
function stayInfo(d){if(!d||!(d.agent||d.agentPhone||d.berth))return '';const L=stayLabels();return `<p class="em-port">${d.berth?`<span>${L.berth}: <b>${h(d.berth)}</b></span>`:''}${d.agent||d.agentPhone?`<span>${L.agent}: ${h(d.agent)} ${tel(d.agentPhone,'em-red')}</span>`:''}</p>`;}
function stopsHtml(stops){const list=cruise()?stops.filter(s=>s.kind==='hafen'||s.agent||s.berth):stops.filter(s=>s.kind!=='reisetag');if(!list.length)return '';
  return `<h4>${cruise()?'Häfen':'Stationen'}</h4><ul class="em-stops">${list.map(s=>`<li><span><strong>${h(s.city||s.name)}</strong> <small>${h(new Date(s.start+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric'}))}</small></span>${stayInfo(s)||`<small class="muted">${cruise()?'Hafenagent':'Unterkunft'} noch nicht eingetragen</small>`}<button type="button" class="secondary small-btn" data-taxi="${h(s.id)}">🚕 Taxi-Karte</button></li>`).join('')}</ul>`;}
function countryHtml(cc,{stops=[],open=false,d=null,lookup=false}={}){
  const places=stops.length?stops.map(s=>s.city||s.name).filter((v,i,a)=>a.indexOf(v)===i).join(', '):'';const main=N?.main(cc)||'—';
  return `<details class="panel em-country${open?' em-now':''}"${open?' open':''} data-cc="${cc}"><summary><span class="em-flag" aria-hidden="true">${flag(cc)}</span><span class="em-cname"><strong>${h(cn(cc))}</strong>${places?`<small>${h(places)}</small>`:lookup?'<small>Nachgeschlagen</small>':''}</span><span class="em-sos">${h(main)}</span></summary>
  <div class="em-body">${numbersHtml(cc)}${missionsBlock(cc,d)}${stopsHtml(stops)}</div></details>`;}

// ---- Taxi-Karte ----
const LANG={
 de:{n:'Deutsch',go:'Bitte bringen Sie mich zum Kreuzfahrtterminal.',go2:'Bitte bringen Sie mich zu dieser Adresse:',ship:'Schiff',port:'Hafen',berth:'Liegeplatz',stay:'Unterkunft',addr:'Adresse',place:'Ort',by:'Ich muss an Bord sein bis',pay:'Was kostet die Fahrt?'},
 en:{n:'Englisch',go:'Please take me to the cruise ship terminal.',go2:'Please take me to this address:',ship:'Ship',port:'Port',berth:'Berth',stay:'Accommodation',addr:'Address',place:'Town',by:'I must be on board by',pay:'How much will it cost?'},
 es:{n:'Spanisch',go:'Por favor, lléveme a la terminal de cruceros.',go2:'Por favor, lléveme a esta dirección:',ship:'Barco',port:'Puerto',berth:'Muelle',stay:'Alojamiento',addr:'Dirección',place:'Lugar',by:'Tengo que estar a bordo antes de las',pay:'¿Cuánto cuesta el viaje?'},
 fr:{n:'Französisch',go:'Conduisez-moi au terminal des croisières, s’il vous plaît.',go2:'Conduisez-moi à cette adresse, s’il vous plaît :',ship:'Navire',port:'Port',berth:'Quai',stay:'Hébergement',addr:'Adresse',place:'Lieu',by:'Je dois être à bord avant',pay:'Combien coûte la course ?'},
 pt:{n:'Portugiesisch',go:'Por favor, leve-me ao terminal de cruzeiros.',go2:'Por favor, leve-me a este endereço:',ship:'Navio',port:'Porto',berth:'Cais',stay:'Alojamento',addr:'Endereço',place:'Local',by:'Preciso estar a bordo até às',pay:'Quanto custa a corrida?'},
 it:{n:'Italienisch',go:'Mi porti al terminal crociere, per favore.',go2:'Mi porti a questo indirizzo, per favore:',ship:'Nave',port:'Porto',berth:'Banchina',stay:'Alloggio',addr:'Indirizzo',place:'Località',by:'Devo essere a bordo entro le',pay:'Quanto costa la corsa?'},
 id:{n:'Indonesisch',go:'Tolong antar saya ke terminal kapal pesiar.',go2:'Tolong antar saya ke alamat ini:',ship:'Kapal',port:'Pelabuhan',berth:'Dermaga',stay:'Penginapan',addr:'Alamat',place:'Tempat',by:'Saya harus naik kapal sebelum pukul',pay:'Berapa ongkosnya?'},
 ms:{n:'Malaiisch',go:'Tolong hantar saya ke terminal kapal persiaran.',go2:'Tolong hantar saya ke alamat ini:',ship:'Kapal',port:'Pelabuhan',berth:'Dermaga',stay:'Penginapan',addr:'Alamat',place:'Tempat',by:'Saya mesti naik kapal sebelum pukul',pay:'Berapa tambangnya?'}};
const GROUPS={de:'DE AT LI',es:'ES MX AR CL CO PE VE EC BO PY UY CR PA GT HN SV NI CU DO PR GQ',fr:'FR MC PF NC RE GP MQ GF YT MF BL PM WF SN CI ML BF NE TG BJ GN CM GA CG CD MG TD CF DJ KM HT TN MA DZ MR',pt:'PT BR CV AO MZ GW ST TL',it:'IT SM VA',id:'ID',ms:'MY BN'};
const CC_LANG={};for(const [l,ccs] of Object.entries(GROUPS))for(const cc of ccs.split(' '))CC_LANG[cc]=l==='de'?['de']:[l,'en'];
Object.assign(CC_LANG,{CH:['de','fr','it'],BE:['fr','en'],LU:['fr','de'],MU:['fr','en'],SC:['en','fr'],CA:['en','fr']});
// Uhrzeit so schreiben, wie man sie vor Ort liest
const H12=new Set('US CA GB IE AU NZ IN PK BD PH MY SG LK MV ZA KE EG SA JO BZ HN CR PA GT MX SV NI DO PR CO VE CK SC MU'.split(' '));
function h12(t,am,pm){const [H,M]=t.split(':').map(Number);return `${H%12||12}:${String(M).padStart(2,'0')} ${H<12?am:pm}`;}
function fmtTime(t,lang,cc){const [H,M]=t.split(':');switch(lang){
  case 'en':return H12.has(cc)?`${h12(t,'AM','PM')} (${t})`:t;
  case 'es':return H12.has(cc)?`${h12(t,'a. m.','p. m.')} (${t})`:t;
  case 'fr':case 'pt':return `${Number(H)}h${M}`;
  case 'id':return `${H}.${M}`;
  case 'ms':return `${t} (${h12(t,'AM','PM')})`;
  case 'it':return t;
  default:return t+' Uhr';}}
function taxiDialog(){let d=q('#taxi-dialog');if(!d){d=document.createElement('dialog');d.id='taxi-dialog';d.className='taxi-dialog';document.body.append(d);d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-taxi-close]'))d.close();});}return d;}
function openTaxi(id){const d=(trip().destinations||[]).find(x=>x.id===id);if(!d)return;const langs=CC_LANG[d.country]||['en'];const ship=cruise(),a=ship?TravelCore.aboard(d):null;const port=d.city||d.name,shipName=trip().settings?.emergency?.ship||'';
  const row=(k,v)=>v?`<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`:'';
  const block=(l,main)=>{const t=LANG[l];return ship
    ?`<div class="taxi-lang${main?' main':''}"><p class="taxi-go">${h(t.go)}</p><dl>${row(t.ship,shipName)}${row(t.port,port)}${row(t.berth,d.berth)}</dl>${a?`<p class="taxi-by">${h(t.by)} <b>${h(fmtTime(a.time,l,d.country))}</b></p>`:''}${main?`<p class="taxi-pay">${h(t.pay)}</p>`:''}</div>`
    :`<div class="taxi-lang${main?' main':''}"><p class="taxi-go">${h(t.go2)}</p><dl>${row(t.stay,d.agent)}${row(t.addr,d.berth)}${row(t.place,port)}</dl>${main?`<p class="taxi-pay">${h(t.pay)}</p>`:''}</div>`;};
  const missing=!ship&&!d.berth?'<p class="taxi-de">Tipp: Adresse der Unterkunft bei dieser Station unter „Meine Route“ → Bearbeiten eintragen.</p>':'';
  const dlg=taxiDialog();dlg.innerHTML=`<div class="taxi-top"><span>${flag(d.country)} Taxi-Karte · ${h(LANG[langs[0]].n)}</span><button type="button" class="icon-btn" data-taxi-close aria-label="Schließen">×</button></div>${langs.map((l,i)=>block(l,i===0)).join('')}${langs[0]==='de'?'':`<p class="taxi-de">Deutsch: ${h(ship?LANG.de.go:LANG.de.go2)}${a?' Wir müssen bis '+h(a.time)+' an Bord sein.':''}</p>`}${missing}`;dlg.showModal();}

// ---- Schiff verpasst (nur Kreuzfahrt) ----
function nextPort(d){const ds=sortedStops(),i=ds.findIndex(x=>x.id===d.id);return ds.slice(i+1).find(x=>x.kind==='hafen'&&x.country)||ds[i+1]||null;}
function missedHtml(cur){if(!cruise())return '';const d=cur?.d,n=d&&nextPort(d),m=d?missionsOf(d.country,d)[0]:null,e=own();
  const fmt=x=>new Date(x.start+'T12:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'long'});
  const steps=[
   ['Ruhe bewahren und sofort den Hafenagenten anrufen',d?.agentPhone?`${h(d.agent||'Hafenagent')} · ${tel(d.agentPhone,'em-red')}`:'Die Nummer steht meist in der Tagesinfo der Reederei'+(d?` – tragt sie bei „${h(d.city||d.name)}“ ein (Stift-Symbol in „Meine Route“)`:'')+'. Sonst am Terminal oder bei der Hafenbehörde nach dem Agenten der Reederei fragen.'],
   ['Notfallnummer der Reederei anrufen',e.operatorPhone?`${h(e.operator||'Reederei')} · ${tel(e.operatorPhone,'em-red')}`:'Noch nicht eingetragen – bei „Eure Angaben“ ergänzen.'],
   ['Pass, Bordkarte und Kreditkarte bereithalten','Der Agent hilft bei der Weiterreise zum nächsten Hafen. Die Kosten tragt ihr in der Regel selbst – außer bei Ausflügen, die über die Reederei gebucht sind.'],
   ['Nächster Hafen',n?`${flag(n.country)} <b>${h(n.city||n.name)}</b>, ${h(cn(n.country))} · ${h(fmt(n))}${n.arrival?' · Ankunft '+h(n.arrival):''}`:'Siehe „Meine Route“.'],
   ['Pass an Bord oder verloren?',m?`Die deutsche Vertretung stellt einen Notreiseausweis aus: ${h(m.name)} ${tel(m.phone)}${m.emergency?' · Notfall '+tel(m.emergency,'em-red'):''}`:'Die deutsche Vertretung im Land hilft mit einem Notreiseausweis (siehe Länderliste unten).']];
  return `<details class="panel em-missed" id="em-missed"><summary><span class="hs-icon" aria-hidden="true">⚓</span><span><strong>Schiff verpasst – was tun?</strong><small>${d?'Für '+h(d.city||d.name):'Schritt für Schritt'}</small></span></summary><ol>${steps.map(([t,x])=>`<li><strong>${t}</strong><span>${x}</span></li>`).join('')}</ol></details>`;}

// ---- Dokumentfotos (nur auf diesem Gerät, für alle Reisen) ----
const DOC_LABELS=['Reisepass','Personalausweis','Versicherungskarte','Impfausweis','Führerschein','Sonstiges'];
function docDb(){return new Promise((res,rej)=>{const r=indexedDB.open('reiseatelier-universal-docs',1);r.onupgradeneeded=()=>r.result.createObjectStore('docs',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function docTx(mode,fn){const db=await docDb();return new Promise((res,rej)=>{const t=db.transaction('docs',mode),st=t.objectStore('docs');const out=fn(st);t.oncomplete=()=>{db.close();res(out?.result);};t.onerror=()=>{db.close();rej(t.error);};});}
const docs={list:()=>docTx('readonly',st=>st.getAll()),put:x=>docTx('readwrite',st=>st.put(x)),del:id=>docTx('readwrite',st=>st.delete(id))};
let docCache=null;
function readImage(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img);};img.onerror=()=>{URL.revokeObjectURL(url);rej(Error('Bild konnte nicht gelesen werden.'));};img.src=url;});}
async function shrinkDoc(file){const img=await readImage(file);const s=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.85);}
function docsHtml(){return `<section class="panel em-docs"><div class="home-panel-head"><h3>Dokumente</h3><span class="em-local-only">nur auf diesem Gerät</span></div><p class="small">Fotos von Pass, Ausweis und Versicherungskarte helfen bei Verlust enorm. Sie bleiben nur auf diesem Gerät – sie kommen nicht in die Abgleich-Datei und nicht in Sicherungen – und gelten für alle Reisen.</p><div id="em-doc-list" class="em-doc-list">${docCache===null?'<p class="muted">Wird geladen …</p>':docCache.length?docCache.map(x=>`<figure class="em-doc"><button type="button" class="em-doc-img" data-doc-open="${h(x.id)}"><img src="${x.data}" alt="${h(x.label)}"></button><figcaption>${h(x.label)}<button type="button" class="icon-btn small" data-doc-del="${h(x.id)}" aria-label="${h(x.label)} löschen">×</button></figcaption></figure>`).join(''):'<p class="muted">Noch keine Dokumente.</p>'}</div><div class="button-row em-doc-add"><select id="em-doc-label" aria-label="Art des Dokuments">${DOC_LABELS.map(l=>`<option>${l}</option>`).join('')}</select><button type="button" class="secondary" id="em-doc-btn">＋ Foto hinzufügen</button><input type="file" id="em-doc-file" accept="image/*" hidden></div></section>`;}
async function loadDocs(){try{docCache=(await docs.list()).sort((a,b)=>a.added.localeCompare(b.added));}catch{docCache=[];}const el=q('#em-docs-slot');if(el){el.innerHTML=docsHtml();}}
function openDoc(id){const x=docCache?.find(d=>d.id===id);if(!x)return;let dlg=q('#doc-dialog');if(!dlg){dlg=document.createElement('dialog');dlg.id='doc-dialog';dlg.className='doc-dialog';document.body.append(dlg);dlg.addEventListener('click',()=>dlg.close());}dlg.innerHTML=`<p>${h(x.label)} · antippen zum Schließen</p><img src="${x.data}" alt="${h(x.label)}">`;dlg.showModal();}

// ---- Länder nachschlagen (alle Länder, auch ohne Reise) ----
let lookupCC='';
function lookupHtml(){const all=(N?.codes||[]).map(cc=>({cc,name:cn(cc)})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  return `<section class="panel em-lookup"><div class="home-panel-head"><h3>Alle Länder nachschlagen</h3><span class="small">${all.length} Länder und Gebiete</span></div><label class="search">⌕ <input id="em-lookup-input" list="em-lookup-list" placeholder="Land eingeben, z. B. Japan" aria-label="Land suchen" autocomplete="off"></label><datalist id="em-lookup-list">${all.map(x=>`<option value="${h(x.name)}"></option>`).join('')}</datalist><div id="em-lookup-result">${lookupCC?countryHtml(lookupCC,{open:true,lookup:true}):''}</div></section>`;}
function findCC(text){const t=norm(text).trim();if(!t)return '';const all=N?.codes||[];return all.find(cc=>norm(cn(cc))===t)||all.find(cc=>cc.toLowerCase()===t)||all.find(cc=>norm(cn(cc)).startsWith(t))||'';}

document.addEventListener('click',async e=>{const t=e.target;
  if(t.closest?.('[data-missed]')){const m=q('#em-missed');if(m){m.open=true;m.scrollIntoView({behavior:'smooth',block:'start'});}return;}
  const tx=t.closest?.('[data-taxi]');if(tx){openTaxi(tx.dataset.taxi);return;}
  if(t.closest?.('#em-doc-btn')){q('#em-doc-file').click();return;}
  const o=t.closest?.('[data-doc-open]');if(o){openDoc(o.dataset.docOpen);return;}
  const del=t.closest?.('[data-doc-del]');if(del){const x=docCache?.find(d=>d.id===del.dataset.docDel);const ok=await confirmAction('Dokument löschen?',`„${x?.label||'Dokument'}“ wird von diesem Gerät entfernt.`,[{label:'Abbrechen',value:false},{label:'Löschen',value:true,className:'danger-btn'}]);if(ok){await docs.del(del.dataset.docDel);await loadDocs();notify('Dokument gelöscht.');}}});
document.addEventListener('change',async e=>{
  if(e.target.id==='em-lookup-input'){const cc=findCC(e.target.value);lookupCC=cc;const box=q('#em-lookup-result');if(box)box.innerHTML=cc?countryHtml(cc,{open:true,lookup:true}):'<p class="small">Kein passendes Land gefunden.</p>';return;}
  if(e.target.id!=='em-doc-file')return;const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const data=await shrinkDoc(f);await docs.put({id:crypto.randomUUID(),label:q('#em-doc-label').value,data,added:new Date().toISOString()});await loadDocs();notify('Dokument gespeichert – nur auf diesem Gerät.');}catch(err){notify('Foto konnte nicht gespeichert werden: '+err.message);}});
document.addEventListener('input',e=>{if(e.target.id!=='em-lookup-input')return;const cc=findCC(e.target.value);if(cc&&norm(cn(cc))===norm(e.target.value).trim()){lookupCC=cc;const box=q('#em-lookup-result');if(box)box.innerHTML=countryHtml(cc,{open:true,lookup:true});}});

// ---- Eigene Angaben ----
function own(){return trip().settings?.emergency||{};}
function fields(){const c=cruise();return [
  ['insurer','Auslandskrankenversicherung','z. B. Name der Versicherung'],['insurerPhone','Notruf der Versicherung','+49 …','tel'],['policy','Versicherungsnummer',''],
  ['operator',c?'Reederei':'Reiseveranstalter / Reisebüro','Name'],['operatorPhone',c?'Notfallnummer der Reederei':'Notfallnummer Veranstalter','+49 …','tel'],
  ['contactName','Kontaktperson 1','Name'],['contactPhone','Telefon Kontaktperson 1','+49 …','tel'],
  ['contact2Name','Kontaktperson 2','Name'],['contact2Phone','Telefon Kontaktperson 2','+49 …','tel'],
  ...(c?[['ship','Schiff','Name des Schiffs'],['cabin','Kabine','z. B. 8123']]:[]),['doctor','Hausarzt / Ärztin','Name und Telefon']];}
function ownView(){const e=own(),rows=[];
  if(e.insurer||e.insurerPhone||e.policy)rows.push(['Versicherung',`${h(e.insurer)}${e.insurerPhone?' · '+tel(e.insurerPhone,'em-red'):''}${e.policy?`<small>Nr. ${h(e.policy)}</small>`:''}`]);
  if(e.operator||e.operatorPhone)rows.push([cruise()?'Reederei':'Veranstalter',`${h(e.operator)}${e.operatorPhone?' · '+tel(e.operatorPhone,'em-red'):''}`]);
  for(const [n,p] of [['contactName','contactPhone'],['contact2Name','contact2Phone']])if(e[n]||e[p])rows.push(['Kontakt',`${h(e[n])}${e[p]?' · '+tel(e[p]):''}`]);
  if(cruise()&&(e.ship||e.cabin))rows.push(['Schiff',`${h(e.ship)}${e.cabin?' · Kabine '+h(e.cabin):''}`]);
  if(e.doctor)rows.push(['Arzt',h(e.doctor)]);
  if(e.medical)rows.push(['Medizinisches',`<span class="em-pre">${h(e.medical)}</span>`]);
  if(e.notes)rows.push(['Notizen',`<span class="em-pre">${h(e.notes)}</span>`]);
  return rows.length?`<dl class="em-own">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`:'<p class="muted">Noch keine eigenen Angaben. Tragt hier Versicherung, Veranstalter und Kontaktpersonen ein – das wird mit dem Abgleich geteilt.</p>';}
let editing=false;
function ownForm(){const e=own();return `<form id="em-form" class="form-grid">${fields().map(([k,l,p,t])=>`<label${k==='doctor'?' class="wide"':''}>${l}<input name="${k}" ${t?`type="${t}" inputmode="tel"`:''} maxlength="200" placeholder="${h(p)}" value="${h(e[k])}"></label>`).join('')}<label class="wide">Medizinisches (Allergien, Medikamente, Blutgruppe)<textarea name="medical" rows="3" maxlength="2000">${h(e.medical)}</textarea></label><label class="wide">Weitere Notizen und Nummern<textarea name="notes" rows="2" maxlength="2000" placeholder="z. B. Botschaft, Mietwagen-Pannendienst, Hotel">${h(e.notes)}</textarea></label><div class="wide button-row"><button class="primary">Angaben speichern</button><button type="button" class="secondary" id="em-cancel">Abbrechen</button></div></form>`;}

function render(){const el=q('#notfall');if(!el||el.hidden)return;const box=q('#notfall-content');if(!box||!N)return;
  const ds=sortedStops(),cur=current(),hc=HC(),homeCC=trip().settings?.home||'DE';
  const byCountry=new Map();for(const d of ds){if(!byCountry.has(d.country))byCountry.set(d.country,[]);byCountry.get(d.country).push(d);}
  const order=[...byCountry.keys()];
  const nowCC=cur?cur.d.country:null;
  let now='';
  if(nowCC){const m=missionsOf(nowCC,cur.d)[0];now=`<section class="panel em-today"><div class="eyebrow">${cur.today?'HEUTE':'NÄCHSTE STATION · '+h(new Date(cur.d.start+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'long'}))}</div><h3>${flag(nowCC)} ${h(cur.d.city||cur.d.name)}, ${h(cn(nowCC))}</h3>${numbersHtml(nowCC,true)}${m&&nowCC!==homeCC?`<ul class="em-missions">${missionHtml(m,cur.d)}</ul>`:''}${stayInfo(cur.d)}<div class="button-row em-actions"><button type="button" class="primary" data-taxi="${h(cur.d.id)}">🚕 Taxi-Karte zeigen</button>${cruise()?'<button type="button" class="secondary" data-missed>⚓ Schiff verpasst?</button>':''}</div></section>`;}
  box.innerHTML=`${cruise()?'<p class="em-onboard"><strong>An Bord zuerst:</strong> Bei einem Notfall auf dem Schiff die Rezeption oder das Bordhospital anrufen (Kabinentelefon). An Land gilt der örtliche Notruf.</p>':''}
  ${now}
  <div class="em-grid">${hc?`<section class="panel"><h3>Wichtige Nummern aus ${h(hc.name)}</h3><ul class="em-list">${hc.CENTRAL.map(n=>`<li><strong>${h(n.label)}</strong>${tel(n.phone,'em-red')}${n.alt?` <span class="small">oder</span> ${tel(n.alt)}`:''}${n.note?`<small>${h(n.note)}</small>`:''}</li>`).join('')}</ul><p class="button-row">${hc.LINKS.map(l=>`<a class="btn-link small-btn" href="${h(l.url)}" target="_blank" rel="noopener">${h(l.label)} ↗</a>`).join('')}</p>${aaStatusHtml()}</section>`:''}
  <section class="panel"><div class="home-panel-head"><h3>Eure Angaben</h3>${editing?'':'<button type="button" class="secondary small-btn" id="em-edit">Bearbeiten</button>'}</div>${editing?ownForm():ownView()}</section></div>
  ${missedHtml(cur)}
  <div id="em-docs-slot">${docsHtml()}</div>
  ${order.length?`<div class="em-head"><h3>Länder der Route</h3><span class="small">Örtliche Notrufe und deutsche Vertretungen · Nummern antippen zum Anrufen</span></div>
  ${order.map(cc=>countryHtml(cc,{stops:byCountry.get(cc)||[],open:cc===nowCC,d:cc===nowCC?cur.d:null})).join('')}`:'<p class="panel muted">Sobald die Route Stationen hat, erscheinen hier die Notrufe der Reiseländer. Jedes Land lässt sich auch unten nachschlagen.</p>'}
  ${lookupHtml()}
  <p class="em-fine">Örtliche Notrufnummern: Stand ${h(N.CHECKED)}, zusammengestellt aus öffentlichen Übersichten (u. a. Wikipedia „List of emergency telephone numbers“). In vielen Ländern leitet das Handy 112 automatisch weiter, verlassen solltet ihr euch darauf aber nicht. Nummern können sich ändern – kurz vor der Abreise prüfen, z. B. in der App „Sicher Reisen“ des Auswärtigen Amts, und in die Krisenvorsorgeliste „ELEFAND“ eintragen.</p>`;
  q('#em-edit')?.addEventListener('click',()=>{editing=true;render();q('#em-form input')?.focus();});
  q('#em-cancel')?.addEventListener('click',()=>{editing=false;render();});
  q('#em-form')?.addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.target.elements,prev=own(),next={};for(const k of TravelCore.EMERGENCY_FIELDS)next[k]=f[k]?(f[k].value||'').trim():(prev[k]||'');const s=trip();
    if(await commit({...s,settings:{...s.settings,emergency:next}},false)){editing=false;render();notify('Notfall-Angaben gespeichert.');}});
}
// Kompakter Hinweis für die Startseite
function homeStrip(){if(!N)return '';const cur=current();const cc=cur?.d.country,main=cc?N.main(cc):'';
  const txt=main?`${cur.today?'Heute':'Nächste Station'}: ${flag(cc)} ${cn(cc)} · Notruf ${main}`:'Notrufe aller Länder, Botschaften und eure Kontakte – auch offline';
  return `<a class="home-sos" href="#notfall"><span class="hs-icon" aria-hidden="true">SOS</span><span><strong>Notfall</strong><small>${h(txt)}</small></span><span class="hc-go" aria-hidden="true">›</span></a>`;}
function liveRefresh(force){const A=globalThis.AAMissions;if(!A)return;A.refresh(force).then(()=>{if(!editing)render();});}
addEventListener('aa-missions-updated',()=>{if(!editing)render();});
document.addEventListener('click',e=>{if(e.target.closest?.('#aa-refresh')){notify('Vertretungen werden abgerufen …');liveRefresh(true);}});
window.TravelEmergency={show(){render();loadDocs();liveRefresh(false);},onTrip(){if(!editing)render();},homeStrip};
const wait=setInterval(()=>{let r=false;try{r=ready;}catch{}if(r){clearInterval(wait);if(location.hash==='#notfall'){render();loadDocs();}}},150);
})();
