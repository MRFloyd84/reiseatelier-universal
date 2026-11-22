'use strict';
/* Tab „Packliste“: Vorlagen passend zu Reiseart, Dauer und Zielen, Kategorien, Zuordnung zu Reisenden, abhaken.
   Einträge liegen in state.packing und werden Eintrag für Eintrag abgeglichen. Vorlagen werden in der gewählten Sprache eingefügt. */
(function(){
const q=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EN=()=>globalThis.RA_LANG==='en';
const L=(de,en)=>EN()?en:de;
function trip(){try{return state;}catch{return {destinations:[],settings:{},packing:[]};}}
function people(){const p=trip().settings?.entry?.people||[];let n=0;p.forEach((x,i)=>{if(x)n=i+1;});return Array.from({length:n},(_,i)=>p[i]||L('Person ','Person ')+(i+1));}
const EU=new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH'.split(' '));
const UK_PLUG=new Set('GB IE MT CY HK SG MY AE QA BH KW KE TZ UG'.split(' ')),US_PLUG=new Set('US CA MX JP TH PH TW CO VE EC PE BR CR PA GT HN SV NI DO CU BS JM'.split(' '));
function facts(){const ds=trip().destinations||[],type=trip().settings?.tripType||'rundreise';
  const starts=ds.map(d=>d.start).sort(),ends=ds.map(d=>d.end||d.start).sort();const days=starts.length?Math.round((Date.parse(ends.at(-1))-Date.parse(starts[0]))/86400000)+1:7;
  const lats=ds.filter(d=>d.lat!==null).map(d=>d.lat);const cc=[...new Set(ds.map(d=>d.country))];
  return {type,days,tropic:lats.some(l=>Math.abs(l)<23.5),cold:lats.some(l=>Math.abs(l)>55)||ds.some(d=>{const m=+d.start.slice(5,7);return d.lat!==null&&((d.lat>40&&(m>=11||m<=3))||(d.lat<-40&&m>=5&&m<=9));}),
    farAway:cc.some(c=>!EU.has(c)),plugs:cc.some(c=>UK_PLUG.has(c)||US_PLUG.has(c)),beach:type==='badeurlaub'||type==='kreuzfahrt'||lats.some(l=>Math.abs(l)<30)};}
/* Vorlagen: [Kennung, Kategorie, Text, Anzahl(Funktion der Tage)?] */
const C={doc:['Dokumente & Geld','Documents & money'],clo:['Kleidung','Clothing'],hyg:['Hygiene','Toiletries'],med:['Reiseapotheke','First aid'],ele:['Elektronik','Electronics'],bea:['Strand & Sonne','Beach & sun'],out:['Wandern & Draußen','Hiking & outdoors'],cru:['Kreuzfahrt','Cruise'],car:['Unterwegs mit dem Auto','By car'],win:['Kälte','Cold weather'],tro:['Tropen','Tropics'],etc:['Sonstiges','Other']};
const T=(id,cat,de,en,qty)=>({id,cat,de,en,qty});
const GROUPS=[
 {id:'basis',label:['Grundausstattung','Basics'],on:()=>true,items:[
  T('pass','doc','Reisepass / Personalausweis','Passport / ID card'),T('karten','doc','Bank- und Kreditkarten','Bank and credit cards'),T('bargeld','doc','Etwas Bargeld (Landeswährung)','Some cash (local currency)'),T('versich','doc','Versicherungskarte und -nummer','Insurance card and number'),T('buchung','doc','Buchungsbestätigungen / Tickets','Booking confirmations / tickets'),
  T('unterw','clo','Unterwäsche','Underwear',d=>Math.min(d+1,8)),T('socken','clo','Socken','Socks',d=>Math.min(d+1,8)),T('tshirt','clo','T-Shirts / Oberteile','T-shirts / tops',d=>Math.min(d,7)),T('hosen','clo','Hosen','Trousers',d=>Math.min(Math.ceil(d/3),3)),T('pulli','clo','Pullover / Jacke','Jumper / jacket'),T('schlaf','clo','Schlafsachen','Sleepwear'),T('schuhe','clo','Bequeme Schuhe','Comfortable shoes'),
  T('zahn','hyg','Zahnbürste und Zahnpasta','Toothbrush and toothpaste'),T('dusch','hyg','Duschgel / Shampoo','Shower gel / shampoo'),T('deo','hyg','Deo','Deodorant'),T('kamm','hyg','Kamm / Bürste','Comb / brush'),
  T('medis','med','Eigene Medikamente','Own medication'),T('pflaster','med','Pflaster und Desinfektion','Plasters and disinfectant'),T('schmerz','med','Schmerz- und Fiebermittel','Pain and fever relief'),
  T('handy','ele','Handy und Ladekabel','Phone and charger'),T('powerbank','ele','Powerbank','Power bank'),T('kopfh','ele','Kopfhörer','Headphones')]},
 {id:'fern',label:['Fernreise','Long-haul'],on:f=>f.farAway,items:[T('impf','doc','Impfpass','Vaccination card'),T('kopien','doc','Kopien der Dokumente (auch im Notfall-Tab)','Copies of documents (also in the Emergency tab)'),T('einreise','doc','Einreisegenehmigungen (siehe Tab „Einreise“)','Entry permits (see “Entry” tab)'),T('magen','med','Mittel gegen Durchfall','Anti-diarrhoea medication'),T('nacken','etc','Nackenkissen für den Flug','Neck pillow for the flight')]},
 {id:'adapter',label:['Reiseadapter','Plug adapter'],on:f=>f.plugs,items:[T('adapter','ele','Reiseadapter (Steckdosen im Zielland prüfen)','Plug adapter (check sockets at destination)')]},
 {id:'strand',label:['Strand & Sonne','Beach & sun'],on:f=>f.beach,items:[T('sonnencr','bea','Sonnencreme (hoher LSF)','Sunscreen (high SPF)'),T('sonnenbr','bea','Sonnenbrille','Sunglasses'),T('hut','bea','Sonnenhut / Kappe','Sun hat / cap'),T('bade','bea','Badesachen','Swimwear'),T('handtuch','bea','Strandtuch','Beach towel'),T('sandalen','bea','Sandalen / Badeschuhe','Sandals / water shoes'),T('after','bea','After-Sun','After-sun')]},
 {id:'tropen',label:['Tropen','Tropics'],on:f=>f.tropic,items:[T('muecke','tro','Mückenschutz','Insect repellent'),T('malaria','tro','Malariaprophylaxe (ärztlich klären)','Malaria prevention (ask a doctor)'),T('regen','tro','Leichte Regenjacke','Light rain jacket'),T('leicht','tro','Leichte, lange Kleidung','Light long-sleeved clothing')]},
 {id:'kaelte',label:['Kälte','Cold weather'],on:f=>f.cold,items:[T('jacke','win','Warme Jacke','Warm jacket'),T('muetze','win','Mütze, Schal, Handschuhe','Hat, scarf, gloves'),T('thermo','win','Thermowäsche','Thermal underwear'),T('lippen','win','Lippenpflege','Lip balm')]},
 {id:'wandern',label:['Wandern & Draußen','Hiking & outdoors'],on:f=>f.type==='wandern',items:[T('wschuhe','out','Wanderschuhe','Hiking boots'),T('rucksack','out','Tagesrucksack','Daypack'),T('trink','out','Trinkflasche','Water bottle'),T('regenj','out','Regenjacke','Rain jacket'),T('stoecke','out','Wanderstöcke','Hiking poles'),T('blasen','med','Blasenpflaster','Blister plasters'),T('karte','out','Karte / Offline-Navigation','Map / offline navigation'),T('stirn','out','Stirnlampe','Head torch')]},
 {id:'kreuz',label:['Kreuzfahrt','Cruise'],on:f=>f.type==='kreuzfahrt',items:[T('abend','cru','Abendgarderobe','Evening wear'),T('bordk','cru','Bordkarte / Reiseunterlagen der Reederei','Cruise card / cruise line documents'),T('see','cru','Mittel gegen Seekrankheit','Seasickness remedy'),T('verl','cru','Mehrfachsteckdose ohne Überspannungsschutz','Power strip without surge protector'),T('fernglas','cru','Fernglas','Binoculars'),T('rucks2','cru','Kleiner Rucksack für Landgänge','Small backpack for shore excursions')]},
 {id:'auto',label:['Unterwegs mit dem Auto','By car'],on:f=>f.type==='rundreise',items:[T('fuehrer','car','Führerschein (ggf. international)','Driving licence (international if needed)'),T('kfz','car','Fahrzeugschein / Mietvertrag','Vehicle registration / rental contract'),T('kfzlade','car','Ladekabel fürs Auto','Car charger'),T('halter','car','Handyhalterung','Phone mount'),T('snacks','car','Snacks und Getränke','Snacks and drinks')]},
 {id:'stadt',label:['Städtereise','City break'],on:f=>f.type==='staedtereise',items:[T('stadtschuh','clo','Gute Laufschuhe','Good walking shoes'),T('stadtplan','etc','Offline-Karte / Stadtplan','Offline map / city map'),T('tasche','etc','Kleine Umhängetasche','Small shoulder bag')]},
];
function catName(k){const c=C[k];return c?L(c[0],c[1]):k;}
let filter='all',hideDone=false,editing=null;
function items(){return trip().packing||[];}
async function save(list){const s=trip();return commit({...s,packing:list},false);}
function suggestion(){const f=facts();return GROUPS.filter(g=>g.on(f));}
function tplHtml(){const f=facts(),have=new Set(items().map(x=>x.tpl).filter(Boolean));
  return `<section class="panel pk-tpl"><h3>${L('Packliste aus Vorlage erstellen','Create packing list from template')}</h3><p class="small">${L(`Vorgeschlagen für ${f.days} Reisetage und eure Ziele. Bereits vorhandene Einträge werden nicht doppelt eingefügt.`,`Suggested for ${f.days} travel days and your destinations. Existing items are not added twice.`)}</p>
  <div class="pk-groups">${GROUPS.map(g=>{const n=g.items.filter(i=>!have.has(i.id)).length;return `<label class="checkbox-label pk-group"><input type="checkbox" data-pk-group="${g.id}"${g.on(f)&&n?' checked':''}${n?'':' disabled'}> ${h(L(g.label[0],g.label[1]))} <small>(${n?n:L('drin','added')})</small></label>`;}).join('')}</div>
  <div class="button-row"><button type="button" class="primary" id="pk-apply">${L('Ausgewählte Vorlagen einfügen','Add selected templates')}</button></div></section>`;}
function itemHtml(x,ppl){const who=x.person>=0?(ppl[x.person]||L('Person ','Person ')+(x.person+1)):'';
  if(editing===x.id)return `<li class="pk-item editing" data-pk="${h(x.id)}"><form class="pk-edit" data-pk-form="${h(x.id)}"><input name="text" maxlength="200" value="${h(x.text)}" required><input name="qty" type="number" min="1" max="999" value="${x.qty}" aria-label="${L('Anzahl','Quantity')}"><select name="person">${personOpts(x.person,ppl)}</select><button class="primary small-btn">${L('OK','OK')}</button><button type="button" class="secondary small-btn" data-pk-cancel>${L('Abbrechen','Cancel')}</button></form></li>`;
  return `<li class="pk-item${x.done?' done':''}" data-pk="${h(x.id)}"><label class="pk-check"><input type="checkbox" data-pk-done="${h(x.id)}"${x.done?' checked':''}><span class="pk-text">${x.qty>1?`<b>${x.qty}×</b> `:''}${h(x.text)}</span></label>${who?`<span class="pk-who">${h(who)}</span>`:''}<span class="pk-tools"><button type="button" class="icon-btn small" data-pk-edit="${h(x.id)}" aria-label="${L('Bearbeiten','Edit')}">✎</button><button type="button" class="icon-btn small" data-pk-del="${h(x.id)}" aria-label="${L('Löschen','Delete')}">×</button></span></li>`;}
function personOpts(sel,ppl){return `<option value="-1"${sel===-1?' selected':''}>${L('Gemeinsam','Shared')}</option>`+ppl.map((n,i)=>`<option value="${i}"${sel===i?' selected':''}>${h(n)}</option>`).join('');}
function render(){const el=q('#packliste');if(!el||el.hidden)return;const box=q('#packliste-content');if(!box)return;const all=items(),ppl=people();
  const list=all.filter(x=>(filter==='all'||(filter==='shared'?x.person===-1:x.person===+filter))&&(!hideDone||!x.done));
  const done=all.filter(x=>x.done).length,cats=[...new Set(all.map(x=>x.cat))];
  const byCat=new Map();for(const x of list){if(!byCat.has(x.cat))byCat.set(x.cat,[]);byCat.get(x.cat).push(x);}
  box.innerHTML=`${all.length?`<div class="panel pk-head"><div class="pk-progress"><b>${done} / ${all.length}</b> ${L('gepackt','packed')}<div class="en-bar"><i style="width:${all.length?Math.round(done/all.length*100):0}%"></i></div></div>
    <div class="button-row pk-filters"><select id="pk-filter" aria-label="${L('Person','Person')}"><option value="all">${L('Alle','Everyone')}</option><option value="shared"${filter==='shared'?' selected':''}>${L('Gemeinsam','Shared')}</option>${ppl.map((n,i)=>`<option value="${i}"${filter===String(i)?' selected':''}>${h(n)}</option>`).join('')}</select><label class="checkbox-label"><input type="checkbox" id="pk-hide"${hideDone?' checked':''}> ${L('Gepacktes ausblenden','Hide packed')}</label><button type="button" class="secondary small-btn" id="pk-reset">${L('Alle Haken entfernen','Untick all')}</button></div></div>`:''}
  <form id="pk-add" class="panel pk-add"><h3>${L('Eintrag hinzufügen','Add item')}</h3><div class="pk-add-row"><input name="text" maxlength="200" required placeholder="${L('z. B. Ladekabel Kamera','e.g. camera charger')}" aria-label="${L('Was?','What?')}"><input name="cat" list="pk-cats" maxlength="40" placeholder="${L('Kategorie','Category')}" aria-label="${L('Kategorie','Category')}"><datalist id="pk-cats">${[...new Set([...cats,...Object.keys(C).map(catName)])].map(c=>`<option value="${h(c)}">`).join('')}</datalist><select name="person" aria-label="${L('Für wen?','For whom?')}">${personOpts(-1,ppl)}</select><input name="qty" type="number" min="1" max="999" value="1" aria-label="${L('Anzahl','Quantity')}"><button class="primary">＋</button></div>${ppl.length?'':`<p class="small">${L('Tipp: Namen der Reisenden unter „Einreise“ → „Reisende eintragen“ hinterlegen, dann lässt sich jedem Eintrag eine Person zuordnen.','Tip: enter the travellers under “Entry” → “Enter travellers” to assign items to a person.')}</p>`}</form>
  ${[...byCat].map(([c,xs])=>`<section class="panel pk-cat"><h3>${h(c)} <span class="number">${xs.filter(x=>x.done).length}/${xs.length}</span></h3><ul class="pk-list">${xs.map(x=>itemHtml(x,ppl)).join('')}</ul></section>`).join('')||(all.length?`<p class="muted">${L('Keine Einträge für diesen Filter.','No items for this filter.')}</p>`:'')}
  ${tplHtml()}`;}
async function applyTemplates(){const f=facts(),have=new Set(items().map(x=>x.tpl).filter(Boolean)),add=[];
  for(const g of GROUPS){const cb=q(`[data-pk-group="${g.id}"]`);if(!cb||!cb.checked)continue;for(const i of g.items){if(have.has(i.id))continue;have.add(i.id);add.push({id:crypto.randomUUID(),text:L(i.de,i.en),cat:catName(i.cat),person:-1,qty:i.qty?i.qty(f.days):1,done:false,tpl:i.id});}}
  if(!add.length){notify(L('Nichts Neues zum Einfügen.','Nothing new to add.'));return;}if(await save([...items(),...add])){render();notify(L(`${add.length} Einträge eingefügt.`,`${add.length} items added.`));}}
document.addEventListener('click',async e=>{const t=e.target;if(!t.closest?.('#packliste'))return;
  if(t.closest('#pk-apply')){applyTemplates();return;}
  const ed=t.closest('[data-pk-edit]');if(ed){editing=ed.dataset.pkEdit;render();q(`[data-pk-form] input`)?.focus();return;}
  if(t.closest('[data-pk-cancel]')){editing=null;render();return;}
  const del=t.closest('[data-pk-del]');if(del){if(await save(items().filter(x=>x.id!==del.dataset.pkDel)))render();return;}
  if(t.closest('#pk-reset')){const ok=await confirmAction(L('Alle Haken entfernen?','Untick everything?'),L('Praktisch für die Rückreise: Alle Einträge gelten wieder als nicht gepackt.','Handy for the way home: all items count as not packed again.'),[{label:L('Abbrechen','Cancel'),value:false},{label:L('Haken entfernen','Untick'),value:true,className:'primary'}]);if(ok&&await save(items().map(x=>({...x,done:false}))))render();}});
document.addEventListener('change',async e=>{const t=e.target;if(!t.closest?.('#packliste'))return;
  const d=t.closest('[data-pk-done]');if(d){if(await save(items().map(x=>x.id===d.dataset.pkDone?{...x,done:d.checked}:x)))render();return;}
  if(t.id==='pk-filter'){filter=t.value;render();return;}if(t.id==='pk-hide'){hideDone=t.checked;render();}});
document.addEventListener('submit',async e=>{const f=e.target;
  if(f.id==='pk-add'){e.preventDefault();const el=f.elements;const item={id:crypto.randomUUID(),text:el.text.value.trim(),cat:el.cat.value.trim()||catName('etc'),person:+el.person.value,qty:Math.max(1,+el.qty.value||1),done:false,tpl:''};if(!item.text)return;
    if(await save([...items(),item])){render();q('#pk-add input[name=text]')?.focus();}return;}
  if(f.dataset.pkForm){e.preventDefault();const el=f.elements,id=f.dataset.pkForm;if(await save(items().map(x=>x.id===id?{...x,text:el.text.value.trim()||x.text,qty:Math.max(1,+el.qty.value||1),person:+el.person.value}:x))){editing=null;render();}}});
function homeLine(){const all=items();if(!all.length)return '';const done=all.filter(x=>x.done).length;return L(`${done} von ${all.length} gepackt`,`${done} of ${all.length} packed`);}
window.TravelPacking={show:render,onTrip(){if(!editing)render();},homeLine};
const wait=setInterval(()=>{let r=false;try{r=ready;}catch{}if(r){clearInterval(wait);if(location.hash==='#packliste')render();}},150);
})();
