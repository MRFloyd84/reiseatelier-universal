'use strict';
/* Tab „Einreise“: Pass, Visa, Einreisegenehmigungen und Formulare als Checkliste – pro Person abhakbar.
   Quellen: hinterlegte Aufgaben (entry-data.js), automatische Prüf-Aufgaben je Land der Route und eigene Aufgaben. */
(function(){
const D=globalThis.EntryData;
const q=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let names=null;try{names=new Intl.DisplayNames(['de'],{type:'region'});}catch{}
const cn=cc=>{try{return names?.of(cc)||cc;}catch{return cc;}};
const flag=cc=>/^[A-Z]{2}$/.test(cc)?String.fromCodePoint(...[...cc].map(c=>127397+c.charCodeAt(0))):'';
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const addDays=(s,n)=>{const d=new Date(s+'T12:00');d.setDate(d.getDate()+n);return iso(d);};
const fmt=s=>new Date(s+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
function trip(){try{return state;}catch{return {destinations:[],settings:{}};}}
const sorted=()=>[...(trip().destinations||[])].sort((a,b)=>(a.start+(a.arrival||'')).localeCompare(b.start+(b.arrival||'')));
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function entry(){const e=trip().settings?.entry||{};return {people:e.people||[],checks:e.checks||{},custom:e.custom||[]};}
/* Reisende: so viele wie Namen eingetragen sind, mindestens eine Person. */
function people(){const p=entry().people;let n=0;p.forEach((x,i)=>{if(x)n=i+1;});n=Math.max(1,n);return Array.from({length:n},(_,i)=>p[i]||(n===1?'Erledigt':'Person '+(i+1)));}
const home=()=>trip().settings?.home||'DE';

function tasks(){const ds=sorted();const out=[];const type=trip().settings?.tripType||'rundreise';
  const start=ds[0]?.start;const abroad=ds.some(d=>d.country!==home());
  if(start)for(const g of D.GENERAL){if(g.types&&!g.types.includes(type))continue;if(g.abroad&&!abroad)continue;out.push({...g,general:true,arrive:start,from:null,until:addDays(start,-g.due)});}
  const routeCC=[...new Set(ds.map(d=>d.country))].filter(cc=>cc!==home());
  for(const t of D.TASKS){let stops=ds.filter(d=>d.country===t.cc);if(t.places)stops=stops.filter(d=>t.places.some(p=>norm(d.city+' '+d.name).includes(p)));if(!stops.length)continue;
    const s=stops[0];out.push({...t,arrive:s.start,port:s.city||s.name,from:t.open?addDays(s.start,-t.open):null,until:addDays(s.start,-t.due)});}
  for(const cc of routeCC){if(D.FREE[cc]||D.TASKS.some(t=>t.cc===cc))continue;const s=ds.find(d=>d.country===cc);
    out.push({id:'aa-'+cc.toLowerCase(),cc,title:`${cn(cc)}: Einreisebestimmungen prüfen`,detail:'Für dieses Land sind keine Formalitäten hinterlegt. Bitte in den Reise- und Sicherheitshinweisen des Auswärtigen Amts unter „Einreise und Zoll“ nachsehen, ob ein Visum, eine elektronische Einreisegenehmigung oder ein Formular nötig ist – und das Ergebnis bei Bedarf als eigene Aufgabe eintragen.',link:D.AA,linkLabel:'Auswärtiges Amt ↗',arrive:s.start,port:s.city||s.name,from:null,until:addDays(s.start,-42),auto:true});}
  for(const c of entry().custom){const s=c.cc?ds.find(d=>d.country===c.cc):null;const until=c.due||s?.start||start||iso(new Date());
    out.push({...c,custom:true,general:!c.cc,arrive:s?.start||until,port:s?(s.city||s.name):'',from:null,until});}
  return out.sort((a,b)=>a.until.localeCompare(b.until));}
function doneBy(t,i){return !!entry().checks[t.id+'|'+i];}
function status(t){const today=iso(new Date()),n=people().length,all=Array.from({length:n},(_,i)=>doneBy(t,i)).every(Boolean);
  if(all)return 'done';if(today>t.arrive)return 'past';if(today>t.until)return 'late';if(!t.from||today>=t.from)return (t.until<=addDays(today,30))?'now':'open';return 'wait';}
const LABEL={past:'Vorbei',done:'Erledigt',late:'Überfällig',now:'Jetzt erledigen',open:'Offen',wait:'Noch nicht möglich'};

function taskHtml(t){const st=status(t),p=people();
  const when=t.general||t.custom?`bis ${fmt(t.until)}`:`${t.from?'ab '+fmt(t.from)+' · ':''}bis ${fmt(t.until)}${t.due===0?' (vor Ankunft)':''}`;
  const where=t.custom?(t.cc?`${flag(t.cc)} ${h(cn(t.cc))} · eigene Aufgabe`:'Eigene Aufgabe'):t.general?'Vor der Reise':`${flag(t.cc)} ${h(cn(t.cc))} · Ankunft ${h(t.port)} ${fmt(t.arrive)}`;
  return `<article class="panel en-task en-${st}" data-task="${h(t.id)}"><div class="en-top"><div><div class="en-where">${where}</div><h3>${h(t.title)}</h3></div><span class="en-badge">${LABEL[st]}</span></div>
  <p class="en-when">⏱ ${when}${t.cost?` · ${h(t.cost)}`:''}</p>${t.detail?`<p class="en-detail">${h(t.detail)}</p>`:''}
  <div class="en-foot">${t.link?`<a class="btn-link small-btn" href="${h(t.link)}" target="_blank" rel="noopener">${h(t.linkLabel||'Offizielle Seite ↗')}</a>`:''}${t.custom?`<button type="button" class="secondary small-btn" data-custom-del="${h(t.id)}">Entfernen</button>`:''}<div class="en-checks" role="group" aria-label="Erledigt von">${p.map((n,i)=>`<label class="en-check${doneBy(t,i)?' on':''}"><input type="checkbox" data-check="${h(t.id)}|${i}"${doneBy(t,i)?' checked':''}><span>${h(n)}</span></label>`).join('')}</div></div></article>`;}

function customForm(){const cc=[...new Set(sorted().map(d=>d.country))];
  return `<details class="panel en-add"><summary>＋ Eigene Aufgabe hinzufügen</summary><form id="en-custom" class="form-grid"><label class="wide">Aufgabe<input name="title" maxlength="200" required placeholder="z. B. Visum für Vietnam beantragen"></label><label>Erledigen bis<input name="due" type="date"></label><label>Land<select name="cc"><option value="">Allgemein</option>${cc.map(c=>`<option value="${c}">${flag(c)} ${h(cn(c))}</option>`).join('')}</select></label><label class="wide">Notiz<textarea name="detail" rows="2" maxlength="2000" placeholder="Kosten, Unterlagen, Hinweise …"></textarea></label><label class="wide">Link (optional)<input name="link" type="url" maxlength="500" placeholder="https://…"></label><div class="wide button-row"><button class="primary">Aufgabe speichern</button></div></form></details>`;}

function render(){const el=q('#einreise');if(!el||el.hidden||!D)return;const box=q('#einreise-content');const ds=sorted();
  if(!ds.length){box.innerHTML='<p class="panel muted">Noch keine Route eingetragen. Sobald Stationen vorhanden sind, erscheint hier die Checkliste.</p>';return;}
  const ts=tasks(),start=ds[0].start,p=people();
  const pre=ts.filter(t=>t.general||!t.from||t.from<start),onb=ts.filter(t=>!pre.includes(t));
  const cnt=i=>ts.filter(t=>doneBy(t,i)).length;
  const routeCC=[...new Set(ds.map(d=>d.country))];
  const free=routeCC.filter(cc=>D.FREE[cc]&&!D.TASKS.some(t=>t.cc===cc));
  const urgent=ts.filter(t=>['late','now'].includes(status(t)));
  const named=entry().people,slots=Math.min(TravelCore.MAX_PEOPLE,Math.max(2,named.filter(Boolean).length+1));
  box.innerHTML=`<div class="en-intro panel"><p><strong>Für deutsche Staatsangehörige.</strong> Jede Person braucht ihre eigenen Genehmigungen – tragt die Namen der Reisenden ein, dann hakt jede für sich ab. Die Haken werden mit der Abgleich-Datei geteilt.</p>
    <div class="en-progress">${p.map((n,i)=>`<div><span>${h(n)}</span><b>${cnt(i)} / ${ts.length}</b><div class="en-bar"><i style="width:${ts.length?Math.round(cnt(i)/ts.length*100):0}%"></i></div></div>`).join('')}</div>
    <details class="en-names"><summary>Reisende eintragen</summary><form id="en-names" class="button-row">${Array.from({length:slots},(_,i)=>`<input name="p${i}" maxlength="40" placeholder="Person ${i+1}" value="${h(named[i]||'')}" aria-label="Name Person ${i+1}">`).join('')}<button class="secondary small-btn">Speichern</button></form></details>
    ${urgent.length?`<p class="en-alert">⚠ ${urgent.length===1?'1 Aufgabe ist':urgent.length+' Aufgaben sind'} jetzt fällig: ${urgent.map(t=>h(t.title)).join(', ')}</p>`:''}</div>
  <h3 class="en-h">Vor der Abreise erledigen</h3>${pre.map(taskHtml).join('')||'<p class="muted">Nichts zu tun.</p>'}
  ${onb.length?`<h3 class="en-h">Unterwegs erledigen <small>– diese Formulare gehen erst kurz vor der Ankunft</small></h3>${onb.map(taskHtml).join('')}`:''}
  ${customForm()}
  ${free.length?`<h3 class="en-h">Keine Formalitäten nötig</h3><section class="panel en-free"><ul>${free.map(cc=>`<li><span>${flag(cc)} <strong>${h(cn(cc))}</strong></span><small>${h(D.FREE[cc])}</small></li>`).join('')}</ul></section>`:''}
  <p class="em-fine">Stand der hinterlegten Länderangaben: ${h(D.CHECKED)} (offizielle Seiten der Länder, Auswärtiges Amt). Einreiseregeln ändern sich – vor der Abreise und vor jedem Land kurz prüfen, z. B. in der App „Sicher Reisen“. Angaben eures Reiseveranstalters gehen vor. Nur auf den offiziellen Seiten beantragen – Vermittler verlangen oft ein Vielfaches.</p>`;}

async function saveEntry(patch){const s=trip(),en=entry();return commit({...s,settings:{...s.settings,entry:{people:en.people,checks:en.checks,custom:en.custom,...patch}}},false);}
document.addEventListener('change',async e=>{const c=e.target.closest?.('[data-check]');if(!c)return;const checks={...entry().checks};
  if(c.checked)checks[c.dataset.check]=iso(new Date());else delete checks[c.dataset.check];
  if(await saveEntry({checks}))render();});
document.addEventListener('submit',async e=>{
  if(e.target.id==='en-names'){e.preventDefault();const f=e.target.elements,list=[];for(let i=0;i<TravelCore.MAX_PEOPLE;i++)list.push(f['p'+i]?.value.trim()||'');while(list.length&&!list.at(-1))list.pop();
    if(await saveEntry({people:list})){render();notify('Reisende gespeichert.');}return;}
  if(e.target.id==='en-custom'){e.preventDefault();const f=e.target.elements;const link=f.link.value.trim();
    if(link&&!/^https:\/\//.test(link)){notify('Bitte einen Link mit https:// eingeben.');return;}
    const item={id:'c-'+Math.random().toString(36).slice(2,10),title:f.title.value.trim(),due:f.due.value,cc:f.cc.value,detail:f.detail.value.trim(),link};
    if(await saveEntry({custom:[...entry().custom,item]})){render();notify('Aufgabe hinzugefügt.');}}});
document.addEventListener('click',async e=>{const b=e.target.closest?.('[data-custom-del]');if(!b)return;const id=b.dataset.customDel;
  const checks=Object.fromEntries(Object.entries(entry().checks).filter(([k])=>!k.startsWith(id+'|')));
  if(await saveEntry({custom:entry().custom.filter(c=>c.id!==id),checks})){render();notify('Aufgabe entfernt.');}});

// Hinweis für die Startseite: nur wenn etwas fällig ist
function homeStrip(){if(!D)return '';const u=tasks().filter(t=>['late','now'].includes(status(t)));if(!u.length)return '';const late=u.some(t=>status(t)==='late');
  return `<a class="home-entry${late?' late':''}" href="#einreise"><span class="hs-icon" aria-hidden="true">✓</span><span><strong>Einreise: ${u.length===1?'1 Aufgabe':u.length+' Aufgaben'} fällig</strong><small>${h(u.slice(0,2).map(t=>t.title).join(' · '))}${u.length>2?' …':''}</small></span><span class="hc-go" aria-hidden="true">›</span></a>`;}
window.TravelEntry={show:render,onTrip:render,homeStrip,tasks,status};
const wait=setInterval(()=>{let r=false;try{r=ready;}catch{}if(r){clearInterval(wait);if(location.hash==='#einreise')render();}},150);
})();
