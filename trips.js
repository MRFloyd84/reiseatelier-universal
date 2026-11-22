'use strict';
/* Reisen verwalten: Wechsler im Kopfbereich mit Liste aller Reisen, neu anlegen, duplizieren, löschen. */
(function(){
const q=s=>document.querySelector(s);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d?new Date(d+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
const types=()=>globalThis.TravelCore?.tripTypes||{};
const label=t=>t.title||'Unbenannte Reise';
const say=m=>{try{notify(m);}catch{}};

async function renderHeader(){const el=q('#trip-switch-name');if(!el)return;try{const list=await TravelStore.trips.list(),cur=list.find(t=>t.id===TravelStore.trips.active);el.textContent=cur?label(cur):'Reise';q('#trip-switch').title=list.length>1?`${list.length} Reisen – antippen zum Wechseln`:'Reisen verwalten';}catch{}
  const fn=q('#sync-filename');if(fn)try{fn.textContent=TravelStore.sync.fileName();}catch{}}

function dialog(){let d=q('#trips-dialog');if(d)return d;d=document.createElement('dialog');d.id='trips-dialog';d.className='trips-dialog';document.body.append(d);
  d.addEventListener('click',e=>{if(e.target===d)d.close();});return d;}

async function open(){const d=dialog(),list=await TravelStore.trips.list(),active=TravelStore.trips.active,T=types();
  list.sort((a,b)=>(a.id===active?-1:b.id===active?1:0)||(b.start||'').localeCompare(a.start||'')||(b.created||'').localeCompare(a.created||''));
  d.innerHTML=`<div class="modal-head"><div><div class="eyebrow">ALLE REISEN AUF DIESEM GERÄT</div><h2>Meine Reisen</h2></div><button type="button" class="icon-btn" data-trips-close aria-label="Schließen">×</button></div>
  <ul class="trips-list">${list.map(t=>`<li class="${t.id===active?'is-active':''}"><div class="tl-main"><strong>${h(label(t))}</strong><small>${h(T[t.type]||'Reise')}${t.start?' · '+h(fmt(t.start))+(t.end&&t.end!==t.start?' – '+h(fmt(t.end)):''):''}</small></div>
    <div class="button-row">${t.id===active?'<span class="tl-badge">Geöffnet</span>':`<button type="button" class="primary small-btn" data-trip-open="${h(t.id)}">Öffnen</button>`}<button type="button" class="secondary small-btn" data-trip-dup="${h(t.id)}">Duplizieren</button><button type="button" class="danger-btn small-btn" data-trip-del="${h(t.id)}">Löschen</button></div></li>`).join('')}</ul>
  <form id="trip-new" class="panel trip-new"><h3>Neue Reise</h3><div class="form-grid"><label class="wide">Name<input name="title" maxlength="100" placeholder="z. B. Roadtrip Schottland 2027" required></label><label class="wide">Art der Reise<select name="type">${Object.entries(T).map(([k,v])=>`<option value="${k}">${h(v)}</option>`).join('')}</select></label></div><div class="button-row"><button class="primary">＋ Reise anlegen und öffnen</button></div></form>
  <p class="small">Jede Reise hat eigene Route, Planung, Einreise-Checkliste, Tagebuch und eine eigene Abgleich-Datei. Dokumentfotos im Tab „Notfall“ gelten für alle Reisen.</p>`;
  if(!d.open)d.showModal();}

document.addEventListener('click',async e=>{const t=e.target;
  if(t.closest?.('#trip-switch')){open();return;}
  if(t.closest?.('[data-trips-close]')){q('#trips-dialog')?.close();return;}
  const o=t.closest?.('[data-trip-open]');if(o){try{await TravelStore.flush();await TravelStore.trips.open(o.dataset.tripOpen);}catch(err){say(err.message);}return;}
  const du=t.closest?.('[data-trip-dup]');if(du){try{du.disabled=true;say('Reise wird kopiert …');await TravelStore.trips.duplicate(du.dataset.tripDup);say('Kopie angelegt.');await open();}catch(err){say('Kopieren fehlgeschlagen: '+err.message);}return;}
  const de=t.closest?.('[data-trip-del]');if(de){const list=await TravelStore.trips.list(),trip=list.find(x=>x.id===de.dataset.tripDel);
    const ok=await confirmAction('Reise löschen?',`„${label(trip||{})}“ wird mit Route, Planung, Tagebuch und Fotos von diesem Gerät entfernt. Das lässt sich nicht rückgängig machen – vorher ggf. die Abgleich-Datei oder eine Sicherung speichern.`,[{label:'Abbrechen',value:false},{label:'Endgültig löschen',value:true,className:'danger-btn'}]);
    if(!ok){open();return;}try{await TravelStore.trips.remove(de.dataset.tripDel);say('Reise gelöscht.');await renderHeader();await open();}catch(err){say(err.message);}}});
document.addEventListener('submit',async e=>{if(e.target.id!=='trip-new')return;e.preventDefault();const f=e.target.elements;
  try{const id=await TravelStore.trips.create({title:f.title.value.trim(),type:f.type.value});
    /* Neue Reise sofort mit Name und Typ anlegen, damit Einstellungen und Verzeichnis übereinstimmen. */
    await TravelStore.flush();await TravelStore.trips.switchQuiet(id);const b=TravelCore.blank(f.type.value);b.settings.title=f.title.value.trim();await TravelStore.save(b);location.reload();}
  catch(err){say('Anlegen fehlgeschlagen: '+err.message);}});
window.TravelTrips={open,renderHeader};
})();
