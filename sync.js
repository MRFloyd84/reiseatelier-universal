'use strict';
/* Abgleich über eine Datei in einem geteilten Ordner (iCloud Drive, Google Drive, OneDrive …): speichern, laden, zusammenführen.
   Jede Reise hat eine eigene Kennung in der Datei. Dateien anderer Reisen führen zum Wechsel oder werden als neue Reise angelegt. */
(function(){
const q=s=>document.querySelector(s);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{try{notify(m);}catch{}};
function ago(iso){if(!iso)return 'noch nie';const m=Math.round((Date.now()-Date.parse(iso))/60000);if(m<1)return 'gerade eben';if(m<60)return `vor ${m} Min.`;const hh=Math.round(m/60);if(hh<24)return `vor ${hh} Std.`;const d=Math.round(hh/24);return d===1?'gestern':`vor ${d} Tagen`;}
const when=iso=>iso?new Date(iso).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
function statusHtml(){const s=TravelStore.sync.status();return (TravelStore.sync.dirty()?'<b class="dirty-note">Ungespeicherte Änderungen</b> · ':'')+`Auf diesem Gerät zuletzt <b>geladen ${h(ago(s.loaded))}</b> · <b>gespeichert ${h(ago(s.saved))}</b>`;}
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
let safariDismissed=false;try{safariDismissed=sessionStorage.getItem('ra.safariDismissed')==='1';}catch{}
function bands(){const mode=TravelStore.mode;
  const sw=q('#safari-warning');if(sw)sw.hidden=!(isIOS&&!standalone()&&!safariDismissed);
  const uw=q('#unsaved-warning');if(uw){const dirty=mode&&mode!=='shared'&&TravelStore.sync.dirty();uw.hidden=!dirty;if(dirty){const c=TravelStore.sync.status().changed;q('#unsaved-text').textContent=`Letzte Änderung ${ago(c)}. Mitreisende sehen sie erst, wenn du die Abgleich-Datei speicherst.`;}}}
function render(){bands();qsa('[data-sync-status]').forEach(el=>el.innerHTML=statusHtml());
  const strip=q('#home-sync');if(strip){const s=TravelStore.sync.status(),stale=!s.loaded||Date.now()-Date.parse(s.loaded)>3*86400000;strip.classList.toggle('sync-stale',TravelStore.mode!=='shared'&&stale);strip.classList.toggle('sync-dirty',TravelStore.sync.dirty());}}
const qsa=s=>[...document.querySelectorAll(s)];
let busy=false;
async function save(){if(busy)return;busy=true;try{toast('Abgleich-Datei wird erstellt …');const r=await TravelStore.sync.exportFile();if(r.ok)toast(`Abgleich-Datei gespeichert (${r.entries} Tagebucheinträge, ${r.photos} Fotos). In den geteilten Ordner legen und „Ersetzen“ wählen.`);}catch(e){toast(e.message);}finally{busy=false;render();}}
async function load(file){if(busy)return;busy=true;try{
  if(file.size>300*1024*1024)throw Error('Datei zu groß.');let data;try{data=JSON.parse(await file.text());}catch{throw Error('Datei ist beschädigt oder keine JSON-Datei.');}
  const who=await TravelStore.sync.whose(data);let created=null,previous=null;
  if(who.kind==='known'){const go=await confirmAction('Andere Reise',`Diese Abgleich-Datei gehört zur Reise „${who.title}“. Zu dieser Reise wechseln? Danach die Datei dort noch einmal laden.`,[{label:'Abbrechen',value:false},{label:'Zur Reise wechseln',value:true,className:'primary'}]);if(go)await TravelStore.trips.open(who.id);return;}
  if(who.kind==='new'){const go=await confirmAction('Neue Reise übernehmen?',`Die Datei enthält die Reise „${who.title}“, die es auf diesem Gerät noch nicht gibt. Als eigene Reise anlegen? Die geöffnete Reise bleibt unverändert.`,[{label:'Abbrechen',value:false},{label:'Als neue Reise anlegen',value:true,className:'primary'}]);if(!go)return;
    previous=TravelStore.trips.active;created=await TravelStore.trips.create({id:who.id,title:who.title,type:who.type});await TravelStore.trips.switchQuiet(created);
    const p=await TravelStore.sync.plan(data);await TravelStore.sync.apply(p);
    try{if(await TravelStore.trips.isEmpty(previous))await TravelStore.trips.remove(previous,{reload:false});}catch{}
    toast('Reise übernommen – wird geöffnet …');setTimeout(()=>location.reload(),600);return;}
  const p=await TravelStore.sync.plan(data),n=p.n;
  if(!p.anything){TravelStore.sync.status();toast('Alles schon auf dem gleichen Stand – nichts zu übernehmen.');localMark();return;}
  const pl=(k,one,many)=>k===1?one:many;const lines=[n.tripNew&&`${n.tripNew} ${pl(n.tripNew,'neue Station','neue Stationen')}`,n.tripUpd&&`${n.tripUpd} ${pl(n.tripUpd,'Änderung','Änderungen')} an Route oder Einstellungen`,n.tripDel&&`${n.tripDel} ${pl(n.tripDel,'gelöschte Station','gelöschte Stationen')}`,n.diaryNew&&`${n.diaryNew} ${pl(n.diaryNew,'neuer Tagebucheintrag','neue Tagebucheinträge')}`,n.diaryUpd&&`${n.diaryUpd} ${pl(n.diaryUpd,'geänderter Tagebucheintrag','geänderte Tagebucheinträge')}`,n.diaryDel&&`${n.diaryDel} ${pl(n.diaryDel,'gelöschter Tagebucheintrag','gelöschte Tagebucheinträge')}`].filter(Boolean);
  const st=TravelStore.sync.status(),older=st.saved&&p.exportedAt&&Date.parse(p.exportedAt)<Date.parse(st.saved);
  const ok=await confirmAction('Abgleich übernehmen?',`Datei vom ${when(p.exportedAt)}.${older?' Hinweis: Sie ist älter als dein letztes Speichern auf diesem Gerät – liegt im Ordner vielleicht eine neuere Datei? Laden schadet trotzdem nicht.':''} Übernommen wird: ${lines.join(', ')}. Bei Änderungen am selben Eintrag gewinnt jeweils die neuere. Vorher wird automatisch eine Sicherheitskopie angelegt.`,[{label:'Abbrechen',value:false},{label:'Abgleichen',value:true,className:'primary'}]);
  if(!ok)return;toast('Abgleich läuft …');const r=await TravelStore.sync.apply(p);
  try{state=TravelCore.validateState(r.state);render_();}catch{}
  window.TravelDiary?.reload?.();toast('Abgleich abgeschlossen.'+(r.backup?' Vorheriger Stand gesichert.':''));
}catch(e){toast('Abgleich fehlgeschlagen: '+e.message);}finally{busy=false;render();}}
function localMark(){try{TravelStore.sync.markLoaded();}catch{}}
function render_(){try{window.__renderTrip?.();}catch{}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-sync]');if(!b)return;if(b.dataset.sync==='save')save();if(b.dataset.sync==='load')q('#sync-file').click();});
/* Mehrere Dateien auf einmal (z. B. wenn Google Drive beim Speichern Kopien angelegt hat): nacheinander zusammenführen, älteste zuerst. */
async function loadMany(files){if(busy)return;busy=true;try{
  const items=[];for(const f of files){if(f.size>300*1024*1024)continue;try{const d=JSON.parse(await f.text());if(d&&d.type==='reiseatelier-abgleich')items.push(d);}catch{}}
  const mine=[];let other=0;for(const d of items){const w=await TravelStore.sync.whose(d);if(w.kind==='same')mine.push(d);else other++;}
  if(!mine.length){toast(other?'Keine der Dateien gehört zur geöffneten Reise. Bitte zuerst die passende Reise öffnen.':'Keine gültige Abgleich-Datei dabei.');return;}
  mine.sort((a,b)=>String(a.exportedAt).localeCompare(String(b.exportedAt)));
  const ok=await confirmAction('Dateien zusammenführen?',`${mine.length} Abgleich-Dateien vom ${when(mine[0].exportedAt)} bis ${when(mine.at(-1).exportedAt)} werden nacheinander übernommen.${other?` ${other} Datei(en) anderer Reisen werden übersprungen.`:''} Bei Änderungen am selben Eintrag gewinnt die neuere. Vorher wird eine Sicherheitskopie angelegt.`,[{label:'Abbrechen',value:false},{label:'Zusammenführen',value:true,className:'primary'}]);
  if(!ok)return;toast('Abgleich läuft …');let r=null;for(const d of mine){const p=await TravelStore.sync.plan(d);if(p.anything)r=await TravelStore.sync.apply(p);}
  localMark();if(r){try{state=TravelCore.validateState(r.state);render_();}catch{}window.TravelDiary?.reload?.();}toast(r?'Abgleich abgeschlossen.':'Alles schon auf dem gleichen Stand.');
}catch(e){toast('Abgleich fehlgeschlagen: '+e.message);}finally{busy=false;render();}}
document.addEventListener('change',e=>{if(e.target.id!=='sync-file')return;const fs=[...e.target.files];e.target.value='';if(fs.length===1)load(fs[0]);else if(fs.length>1)loadMany(fs);});
/* App installieren (Android, Chrome/Edge am Computer): Browser-Angebot abfangen und als Knopf anbieten. */
let installEvt=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;document.querySelectorAll('[data-install]').forEach(b=>b.hidden=false);});
addEventListener('appinstalled',()=>{installEvt=null;document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true);toast('App installiert. Ab jetzt über das Symbol starten.');});
document.addEventListener('click',async e=>{if(!e.target.closest?.('[data-install]')||!installEvt)return;installEvt.prompt();try{await installEvt.userChoice;}catch{}installEvt=null;document.querySelectorAll('[data-install]').forEach(b=>b.hidden=true);});
window.addEventListener('travel-sync-status',render);
document.addEventListener('click',e=>{if(e.target.id==='safari-dismiss'){safariDismissed=true;try{sessionStorage.setItem('ra.safariDismissed','1');}catch{}bands();}});
addEventListener('DOMContentLoaded',bands);
window.TravelSync={render};
setInterval(render,60000);
})();
