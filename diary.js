'use strict';
/* Mein Reisetagebuch: Einträge mit Stimmung, Wetter, Fotos; Liste und Kalender. */
(function(){
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MOODS={begeistert:'Begeistert',gluecklich:'Glücklich',entspannt:'Entspannt',nachdenklich:'Nachdenklich',erschoepft:'Erschöpft',wehmuetig:'Wehmütig'};
const MOOD_SYM={begeistert:'✶',gluecklich:'☺',entspannt:'≈',nachdenklich:'…',erschoepft:'◡',wehmuetig:'♡'};
const WEATHER={sonnig:'☀ Sonnig',heiter:'⛅ Heiter',bewoelkt:'☁ Bewölkt',regen:'☂ Regen',gewitter:'ϟ Gewitter',wind:'≋ Windig',schnee:'❄ Schnee'};
const MAX_PHOTOS=12;
let entries=[],loaded=false,loading=null,view='list',month=null,editingId=null,draftPhotos=[],removedPhotos=[];
const photoCache=new Map();
const trip=()=>{try{return state;}catch{return {destinations:[]};}};
const toast=m=>{try{notify(m);}catch{}};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const fmtDate=d=>new Date(d+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const destName=id=>{const d=trip().destinations.find(x=>x.id===id);return d?d.name:'';};
function destForDate(date){const ds=trip().destinations.filter(d=>d.start&&d.start<=date&&(d.end||d.start)>=date);return ds.length?ds[ds.length-1]:null;}
function tripRange(){const ds=trip().destinations.filter(d=>d.start);if(!ds.length)return null;return [ds.map(d=>d.start).sort()[0],ds.map(d=>d.end||d.start).sort().at(-1)];}

async function load(){if(loaded)return;if(loading)return loading;loading=(async()=>{try{entries=await TravelStore.diary.list();loaded=true;TravelStore.diary.watch(list=>{entries=list;renderAll();});}catch(e){q('#diary-list').innerHTML=`<p class="diary-error">Tagebuch konnte nicht geladen werden: ${h(e.message)}</p>`;}finally{loading=null;}})();return loading;}

/* ---------- Fotos ---------- */
function loadImage(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img);};img.onerror=()=>{URL.revokeObjectURL(url);rej(Error('Bild konnte nicht gelesen werden: '+file.name));};img.src=url;});}
async function shrink(file){const img=await loadImage(file);let edge=1600,quality=.82,out='';for(let i=0;i<10;i++){const s=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);out=c.toDataURL('image/jpeg',quality);if(out.length<=230000)return out;if(quality>.6)quality-=.08;else edge=Math.round(edge*.82);}throw Error('Foto lässt sich nicht klein genug speichern: '+file.name);}
async function photo(id){if(photoCache.has(id))return photoCache.get(id);const p=TravelStore.diary.getPhoto(id).catch(()=>null);photoCache.set(id,p);return p;}
function hydratePhotos(root){root.querySelectorAll('img[data-photo]').forEach(async img=>{if(img.dataset.done)return;img.dataset.done='1';const d=await photo(img.dataset.photo);if(d)img.src=d;else img.closest('.ph')?.classList.add('ph-missing');});}

/* ---------- Darstellung ---------- */
const dayFilter=()=>q('#diary-date').value;
function filtered(){const raw=(q('#diary-search').value||'').trim().toLocaleLowerCase('de'),dest=q('#diary-dest').value,day=dayFilter();
  const m=raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);const iso=m?`${m[3]?(m[3].length===2?'20'+m[3]:m[3]):''}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';
  return entries.filter(e=>(!day||e.date===day)&&(!dest||e.destinationId===dest)&&(!raw||(iso?e.date.endsWith(iso.replace(/^-/,'')):false)||[e.title,e.text,e.place,destName(e.destinationId),fmtDate(e.date),e.date].join(' ').toLocaleLowerCase('de').includes(raw)))
  .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));}
function card(e){const dn=destName(e.destinationId)||e.place||'';const ph=(e.photos||[]);
  return `<article class="diary-entry" data-id="${h(e.id)}"><div class="de-head"><div><div class="diary-date">${h(fmtDate(e.date))}${e.time?' · '+h(e.time)+' Uhr':''}</div><h3>${h(e.title||'Ohne Titel')}</h3><div class="diary-meta">${dn?`<span>⚑ ${h(dn)}</span>`:''}${e.mood?`<span>${MOOD_SYM[e.mood]||''} ${h(MOODS[e.mood]||'')}</span>`:''}${e.weather?`<span>${h(WEATHER[e.weather]||'')}${e.temp!==null&&e.temp!==undefined&&e.temp!==''?' · '+h(e.temp)+' °C':''}</span>`:''}</div></div><div class="diary-actions"><button type="button" class="secondary small-btn" data-postcard="${h(e.id)}" title="Als Postkarte teilen">✉ Postkarte</button><button class="secondary small-btn" data-edit="${h(e.id)}">Bearbeiten</button></div></div>${e.text?`<div class="diary-text">${h(e.text).replace(/\n/g,'<br>')}</div>`:''}${ph.length?`<div class="diary-photos">${ph.map((p,i)=>`<button type="button" class="ph" data-open="${h(e.id)}" data-i="${i}" aria-label="Foto ${i+1} vergrößern"><img data-photo="${h(p)}" alt="Foto ${i+1} zu ${h(e.title||'Eintrag')}"></button>`).join('')}</div>`:''}</article>`;}
function renderList(){const list=filtered(),box=q('#diary-list');q('#diary-count').textContent=list.length===1?'1 Eintrag':list.length+' Einträge';
  if(!entries.length){box.innerHTML=`<div class="empty"><div class="empty-icon">▤</div><h3>Deine Erinnerungen beginnen hier.</h3><p>Halte deinen ersten Reisemoment fest – mit oder ohne Destination und Fotos.</p><button class="primary" data-diary-new>＋ Ersten Eintrag erstellen</button></div>`;return;}
  if(!list.length){const day=dayFilter();box.innerHTML=`<div class="empty"><h3>Keine Einträge für diese Auswahl.</h3><p>${day?'Am '+h(fmtDate(day))+' gibt es noch keinen Eintrag.':'Passe die Filter an oder setze sie zurück.'}</p>${day?'<button class="primary" data-diary-new>＋ Eintrag für diesen Tag</button>':''}</div>`;return;}
  let html='',last='';for(const e of list){const m=new Date(e.date+'T12:00:00').toLocaleDateString('de-DE',{month:'long',year:'numeric'});if(m!==last){html+=`<h3 class="diary-month">${h(m)}</h3>`;last=m;}html+=card(e);}
  box.innerHTML=html;hydratePhotos(box);}
function renderCalendar(){const box=q('#diary-calendar');if(!month){const r=tripRange(),t=today();month=(r&&!(t>=r[0]&&t<=r[1])&&t<r[0]?r[0]:t).slice(0,7);}
  const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1),days=new Date(y,m,0).getDate(),offset=(first.getDay()+6)%7,r=tripRange(),t=today();
  const count={};entries.forEach(e=>count[e.date]=(count[e.date]||0)+1);
  let cells='';for(let i=0;i<offset;i++)cells+='<div class="cal-cell cal-empty"></div>';
  for(let d=1;d<=days;d++){const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dest=destForDate(ds),inTrip=r&&ds>=r[0]&&ds<=r[1],n=count[ds]||0;
    cells+=`<button type="button" class="cal-cell${inTrip?' cal-trip':''}${n?' cal-has':''}${ds===t?' cal-today':''}${ds===dayFilter()?' cal-sel':''}" data-day="${ds}" aria-label="${h(fmtDate(ds))}${dest?', '+h(dest.name):''}${n?', '+n+' Einträge':''}"><span class="cal-num">${d}</span>${dest?`<span class="cal-dest">${h(dest.name)}</span>`:inTrip?'<span class="cal-dest cal-sea">auf See</span>':''}${n?`<span class="cal-count">${n}</span>`:''}</button>`;}
  box.innerHTML=`<div class="cal-head"><button type="button" class="secondary small-btn" data-cal="-1" aria-label="Vorheriger Monat">‹</button><h3>${h(first.toLocaleDateString('de-DE',{month:'long',year:'numeric'}))}</h3><button type="button" class="secondary small-btn" data-cal="1" aria-label="Nächster Monat">›</button></div><div class="cal-grid">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>`<div class="cal-wd">${w}</div>`).join('')}${cells}</div><p class="cal-legend"><span class="lg lg-trip"></span> Reisetag <span class="lg lg-has"></span> mit Eintrag · Tag antippen zeigt seine Einträge</p>`;}
function renderStats(){q('#ds-entries').textContent=entries.length;q('#ds-days').textContent=new Set(entries.map(e=>e.date)).size;q('#ds-photos').textContent=entries.reduce((a,e)=>a+(e.photos||[]).length,0);q('#ds-dests').textContent=new Set(entries.map(e=>e.destinationId).filter(Boolean)).size;}
function fillDestSelects(){const opts=trip().destinations.slice().sort((a,b)=>(a.start||'').localeCompare(b.start||'')).map(d=>`<option value="${h(d.id)}">${h(d.name)}${d.start?' · '+h(new Date(d.start+'T12:00:00').toLocaleDateString('de-DE')):''}</option>`).join('');
  for(const [sel,first] of [['#diary-dest','Alle Destinationen'],['#diary-form-dest','Keine Destination']]){const el=q(sel),v=el.value;el.innerHTML=`<option value="">${first}</option>`+opts;el.value=v;}}
function renderAll(){if(!q('#tagebuch'))return;fillDestSelects();renderStats();q('#diary-calendar').hidden=view!=='calendar';qa('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));if(view==='calendar')renderCalendar();renderList();}

/* ---------- Bearbeiten ---------- */
function drawDraftPhotos(){const box=q('#diary-form-photos');box.innerHTML=draftPhotos.map((p,i)=>`<div class="ph ph-edit"><img ${p.data?`src="${p.data}"`:`data-photo="${h(p.id)}"`} alt="Foto ${i+1}"><button type="button" class="ph-del" data-del="${i}" aria-label="Foto ${i+1} entfernen">×</button></div>`).join('');hydratePhotos(box);q('#diary-photo-note').textContent=`${draftPhotos.length} von ${MAX_PHOTOS} Fotos`;}
function openForm(id,date){const f=q('#diary-form');f.reset();q('#diary-form-error').textContent='';editingId=id||null;removedPhotos=[];const e=id?entries.find(x=>x.id===id):null;
  q('#diary-form-title').textContent=e?'Eintrag bearbeiten':'Neuer Tagebucheintrag';q('#diary-delete').hidden=!e;fillDestSelects();
  const d=e?e.date:(date||(()=>{const r=tripRange(),t=today();return r&&t<r[0]?r[0]:t;})());
  f.elements.date.value=d;f.elements.time.value=e?.time||'';f.elements.title.value=e?.title||'';f.elements.text.value=e?.text||'';f.elements.mood.value=e?.mood||'';f.elements.weather.value=e?.weather||'';f.elements.temp.value=e?.temp??'';f.elements.place.value=e?.place||'';
  f.elements.dest.value=e?(e.destinationId||''):(destForDate(d)?.id||'');draftPhotos=(e?.photos||[]).map(pid=>({id:pid}));drawDraftPhotos();q('#diary-dialog').showModal();}
async function submit(ev){ev.preventDefault();const f=ev.target,btn=q('#diary-save');const err=q('#diary-form-error');err.textContent='';
  const date=f.elements.date.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){err.textContent='Bitte ein Datum wählen.';return;}
  const temp=f.elements.temp.value===''?null:Number(f.elements.temp.value);if(temp!==null&&(!Number.isFinite(temp)||temp<-90||temp>65)){err.textContent='Temperatur bitte zwischen −90 und 65 °C.';return;}
  if(!f.elements.title.value.trim()&&!f.elements.text.value.trim()&&!draftPhotos.length){err.textContent='Bitte Titel, Text oder ein Foto ergänzen.';return;}
  btn.disabled=true;btn.textContent='Wird gespeichert …';
  try{const ids=[];for(const p of draftPhotos){if(p.data){const pid=crypto.randomUUID();await TravelStore.diary.putPhoto(pid,p.data);photoCache.set(pid,Promise.resolve(p.data));ids.push(pid);}else ids.push(p.id);}
    const entry={id:editingId||crypto.randomUUID(),date,time:f.elements.time.value||'',title:f.elements.title.value.trim().slice(0,200),text:f.elements.text.value.slice(0,20000),mood:MOODS[f.elements.mood.value]?f.elements.mood.value:'',weather:WEATHER[f.elements.weather.value]?f.elements.weather.value:'',temp,place:f.elements.place.value.trim().slice(0,200),destinationId:f.elements.dest.value||'',photos:ids,created:entries.find(x=>x.id===editingId)?.created||new Date().toISOString()};
    const saved=await TravelStore.diary.save(entry);for(const pid of removedPhotos)TravelStore.diary.dropPhoto(pid);
    entries=entries.filter(x=>x.id!==saved.id).concat(saved);q('#diary-dialog').close();renderAll();toast(editingId?'Eintrag aktualisiert.':'Eintrag gespeichert.');}
  catch(e){err.textContent='Nicht gespeichert: '+(e&&e.code==='invalid_argument'?'Keine Schreibrechte. Bitte als Bearbeiter*in einladen lassen.':e.message);}finally{btn.disabled=false;btn.textContent='Eintrag speichern';}}
async function removeEntry(){const e=entries.find(x=>x.id===editingId);if(!e)return;q('#diary-dialog').close();
  const ok=await confirmAction('Eintrag löschen?',`„${e.title||fmtDate(e.date)}“ mit ${(e.photos||[]).length} Fotos wird endgültig entfernt.`,[{label:'Abbrechen',value:false},{label:'Löschen',value:true,className:'danger-btn'}]);if(!ok)return;
  try{await TravelStore.diary.remove(e.id);(e.photos||[]).forEach(p=>TravelStore.diary.dropPhoto(p));entries=entries.filter(x=>x.id!==e.id);renderAll();toast('Eintrag gelöscht.');}catch(err){toast('Löschen fehlgeschlagen: '+err.message);}}

/* ---------- Lightbox ---------- */
let lb={list:[],i:0};
async function showLb(){const img=q('#lightbox-img');img.removeAttribute('src');img.src=(await photo(lb.list[lb.i]))||'';q('#lightbox-count').textContent=`${lb.i+1} / ${lb.list.length}`;}
function openLb(id,i){const e=entries.find(x=>x.id===id);if(!e)return;lb={list:e.photos||[],i:Number(i)};q('#lightbox-cap').textContent=e.title||fmtDate(e.date);q('#lightbox').showModal();showLb();}

/* ---------- Export / Import ---------- */
async function exportDiary(){try{await load();toast('Tagebuch wird zusammengestellt …');const out=[];for(const e of entries){const photos=[];for(const p of e.photos||[])photos.push(await photo(p));out.push({...e,photos:photos.filter(Boolean)});}
  if(await TravelStore.download('reiseatelier-tagebuch.json',JSON.stringify({type:'reiseatelier-tagebuch',version:1,exportedAt:new Date().toISOString(),entries:out})))toast('Tagebuch exportiert.');}catch(e){toast(e.message);}}
async function importDiary(file){try{await load();if(file.size>200*1024*1024)throw Error('Datei zu groß.');const data=JSON.parse(await file.text());if(data.type!=='reiseatelier-tagebuch'||!Array.isArray(data.entries))throw Error('Keine Tagebuch-Sicherung.');
  const ok=await confirmAction('Tagebuch importieren',`${data.entries.length} Einträge werden ergänzt. Bestehende Einträge mit gleicher Kennung werden überschrieben.`,[{label:'Abbrechen',value:false},{label:'Importieren',value:true,className:'primary'}]);if(!ok)return;
  let n=0;for(const e of data.entries){if(!e||!/^\d{4}-\d{2}-\d{2}$/.test(e.date))continue;const ids=[];for(const d of (e.photos||[]).slice(0,MAX_PHOTOS)){if(typeof d==='string'&&d.startsWith('data:image/')&&d.length<=240000){const pid=crypto.randomUUID();await TravelStore.diary.putPhoto(pid,d);ids.push(pid);}}
    const entry={id:typeof e.id==='string'&&e.id.length<80?e.id:crypto.randomUUID(),date:e.date,time:/^\d{2}:\d{2}$/.test(e.time||'')?e.time:'',title:String(e.title||'').slice(0,200),text:String(e.text||'').slice(0,20000),mood:MOODS[e.mood]?e.mood:'',weather:WEATHER[e.weather]?e.weather:'',temp:Number.isFinite(e.temp)?e.temp:null,place:String(e.place||'').slice(0,200),destinationId:String(e.destinationId||''),photos:ids,created:e.created||new Date().toISOString()};
    await TravelStore.diary.save(entry);entries=entries.filter(x=>x.id!==entry.id).concat(entry);n++;}
  renderAll();toast(n+' Einträge importiert.');}catch(e){toast('Import fehlgeschlagen: '+e.message);}}

/* ---------- Ereignisse ---------- */
function bind(){
  document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t||!t.closest('#tagebuch,#diary-dialog,#lightbox,#einstellungen'))return;
    if(t.matches('[data-diary-new]'))openForm(null,dayFilter()||undefined);
    else if(t.dataset.edit)openForm(t.dataset.edit);
    else if(t.dataset.open)openLb(t.dataset.open,t.dataset.i);
    else if(t.dataset.view){view=t.dataset.view;renderAll();}
    else if(t.dataset.cal){const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+Number(t.dataset.cal),1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');renderCalendar();}
    else if(t.dataset.day){q('#diary-date').value=q('#diary-date').value===t.dataset.day?'':t.dataset.day;renderAll();if(q('#diary-date').value)q('#diary-count').scrollIntoView({behavior:'smooth',block:'start'});}
    else if(t.dataset.del!==undefined){const p=draftPhotos.splice(Number(t.dataset.del),1)[0];if(p&&p.id)removedPhotos.push(p.id);drawDraftPhotos();}
  });
  q('#diary-reset').onclick=()=>{q('#diary-search').value='';q('#diary-dest').value='';q('#diary-date').value='';renderAll();};
  ['#diary-search','#diary-dest'].forEach(s=>q(s).addEventListener('input',renderList));q('#diary-date').addEventListener('input',()=>{const v=q('#diary-date').value;if(v)month=v.slice(0,7);renderAll();});
  q('#diary-form').onsubmit=submit;q('#diary-close').onclick=()=>q('#diary-dialog').close();q('#diary-delete').onclick=removeEntry;
  q('#diary-form').elements.date.addEventListener('change',e=>{const d=destForDate(e.target.value);if(d&&!editingId)q('#diary-form-dest').value=d.id;});
  q('#diary-add-photos').onclick=()=>q('#diary-file').click();
  q('#diary-file').onchange=async e=>{const files=[...e.target.files].filter(f=>f.type.startsWith('image/'));e.target.value='';const room=MAX_PHOTOS-draftPhotos.length;if(files.length>room)toast(`Höchstens ${MAX_PHOTOS} Fotos pro Eintrag.`);
    q('#diary-photo-note').textContent='Fotos werden verkleinert …';for(const f of files.slice(0,room)){try{draftPhotos.push({data:await shrink(f)});}catch(err){toast(err.message);}}drawDraftPhotos();};
  q('#lightbox-close').onclick=()=>q('#lightbox').close();q('#lightbox-prev').onclick=()=>{lb.i=(lb.i-1+lb.list.length)%lb.list.length;showLb();};q('#lightbox-next').onclick=()=>{lb.i=(lb.i+1)%lb.list.length;showLb();};
  q('#lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')q('#lightbox-prev').click();if(e.key==='ArrowRight')q('#lightbox-next').click();});
  q('#diary-export').onclick=exportDiary;q('#diary-import').onclick=()=>q('#diary-import-file').click();q('#diary-import-file').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)importDiary(f);};
}
window.TravelDiary={async show(){await load();renderAll();},async reload(){loaded=false;photoCache.clear();if(!q('#tagebuch').hidden){await load();renderAll();}},onTrip(){if(loaded&&!q('#tagebuch').hidden)renderAll();},moods:MOODS,weather:WEATHER};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
/* Falls die Reise schon vor diesem Skript geladen wurde: Tagebuch nachträglich zeigen. */
const wait=setInterval(()=>{let r=false;try{r=ready;}catch{}if(r){clearInterval(wait);if(location.hash==='#tagebuch')window.TravelDiary.show();if(!location.hash||location.hash==='#start')window.TravelHome?.show();}},150);
})();
