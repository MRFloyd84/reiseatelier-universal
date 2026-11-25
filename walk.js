'use strict';
/* Tab „Zu Fuß“: Spaziergänge mit mehreren Punkten planen, Fußweg berechnen, auf der Karte zeigen und mit
   Live-Position, Abbiegehinweisen und Sprachansagen navigieren. Offline-Kartenpakete verwalten.
   Spaziergänge (Punkte) liegen in state.walks und werden abgeglichen; berechnete Wege und Kartenpakete bleiben
   auf dem jeweiligen Gerät. Texte stehen hier zweisprachig (L(de,en)), deshalb ist der Bereich von der
   automatischen Übersetzung ausgenommen. */
(function(){
const W=window.TravelWalkCore,M=window.TravelMaps;
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EN=()=>globalThis.RA_LANG==='en',L=(de,en)=>EN()?en:de,LG=()=>EN()?'en':'de';
const trip=()=>{try{return state;}catch{return {destinations:[],walks:[],settings:{}};}};
const walks=()=>trip().walks||[];
const LS={get:(k,d)=>{try{const v=localStorage.getItem('rau.walk.'+k);return v===null?d:v;}catch{return d;}},set:(k,v)=>{try{localStorage.setItem('rau.walk.'+k,v);}catch{}}};
const engine=()=>LS.get('engine','fossgis')==='ors'&&LS.get('orsKey','')?'ors':'fossgis';
const voiceOn=()=>LS.get('voice','1')==='1';
const toast=m=>{try{notify(m);}catch{}};
const uid=()=>crypto.randomUUID();
let cur=null,map=null,mapPack=undefined,markers=[],userMarker=null,route=null,routeState='',routeTimer=null,picking=false,lastFix=null,searchTimer=null,searchCtl=null,dl=null,nav=null,lastRouteReq=0;
function current(){const ws=walks();if(!ws.length)return null;const id=cur||LS.get('cur','');return ws.find(w=>w.id===id)||ws[ws.length-1];}
async function save(next){const ws=walks().map(w=>w.id===next.id?next:w);if(!ws.some(w=>w.id===next.id))ws.push(next);cur=next.id;LS.set('cur',next.id);await commit({...trip(),walks:ws},false);}
const dests=()=>trip().destinations.filter(d=>d.lat!==null&&d.lng!==null);
const destName=id=>{const d=trip().destinations.find(x=>x.id===id);return d?d.name:'';};
/* Punkte, die für den Weg benutzt werden (Rundweg: zurück zum Start) */
function routePoints(w,from){const st=w.stops.map(s=>[s.lat,s.lng]),names=w.stops.map(s=>s.name);if(w.loop&&st.length>1){st.push(st[0]);names.push(names[0]);}if(from){st.unshift(from);names.unshift(L('Mein Standort','My location'));}return {points:st,names};}
/* ---------- Route holen (aus dem Gerätespeicher oder vom Routing-Dienst) ---------- */
async function fetchRoute(points,names,{force=false}={}){const eng=engine(),key=W.routeKey(points,eng,false);
  if(!force){const c=await M.getRoute(key);if(c&&c.coords)return W.prep(c);}
  if(!navigator.onLine)throw Object.assign(Error(L('Ohne Internet kann kein neuer Weg berechnet werden.','A new route needs an internet connection.')),{offline:true});
  if(points.length>W.ENGINES[eng].max)throw Error(L(`Höchstens ${W.ENGINES[eng].max} Punkte pro Weg.`,`At most ${W.ENGINES[eng].max} points per route.`));
  const wait=1100-(Date.now()-lastRouteReq);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastRouteReq=Date.now();
  const {url,init}=W.ENGINES[eng].request(points,{key:LS.get('orsKey',''),lang:LG()});let res;
  try{res=await fetch(url,{...init,signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});}catch(e){throw Error(L('Routing-Dienst nicht erreichbar.','Routing service unreachable.'));}
  let j=null;try{j=await res.json();}catch{}
  if(res.status===429)throw Error(L('Zu viele Anfragen – bitte kurz warten.','Too many requests – please wait a moment.'));
  if(res.status===401||res.status===403)throw Error(L('openrouteservice-Schlüssel ungültig.','openrouteservice key invalid.'));
  if(!res.ok&&!(j&&(j.routes||j.features)))throw Error((j&&(j.message||j.error?.message))||L('Kein Fußweg gefunden.','No walking route found.'));
  const r=eng==='ors'?W.parseORS(j,names):W.parseOSRM(j,names);await M.putRoute(key,W.strip(r));return r;}
async function loadRoute(force){const w=current();route=null;if(!w||w.stops.length<2){routeState=w&&w.stops.length===1?'one':'';renderSummary();drawRoute();return;}
  const {points,names}=routePoints(w);routeState='loading';renderSummary();
  try{route=await fetchRoute(points,names,{force});routeState='ok';}catch(e){route=null;routeState=e.offline?'offline':'error:'+e.message;}
  if(current()?.id!==w.id)return;renderSummary();drawRoute();}
function scheduleRoute(){clearTimeout(routeTimer);routeTimer=setTimeout(()=>loadRoute(false),900);}
window.addEventListener('online',()=>{if(routeState==='offline')loadRoute(false);renderOffline();});
window.addEventListener('offline',()=>renderOffline());
/* ---------- Seite ---------- */
function render(){const box=q('#zufuss-content');if(!box)return;const w=current();cur=w?.id||null;if(sg.walkId!==(w?.id||null)){sg.over=null;sg.walkId=w?.id||null;}const ws=walks();
  const head=`<div class="wk-top"><label class="wk-pick">${L('Spaziergang','Walk')}<select id="wk-select">${ws.map(x=>`<option value="${h(x.id)}" ${w&&x.id===w.id?'selected':''}>${h(x.title)}${x.dest?' · '+h(destName(x.dest)):''}</option>`).join('')}</select></label><button type="button" class="secondary" id="wk-new">＋ ${L('Neuer Spaziergang','New walk')}</button></div>`;
  if(!w){box.innerHTML=(ws.length?head:'')+`<div class="empty"><div class="empty-icon">🚶</div><h3>${L('Zu Fuß durch die Stadt','On foot through the city')}</h3><p>${L('Plane einen Spaziergang mit mehreren Punkten. Die App berechnet den Fußweg, zeigt ihn auf der Karte und führt dich mit Abbiegehinweisen und Sprachansagen – mit Offline-Karte auch ohne Netz.','Plan a walk with several stops. The app works out the walking route, shows it on the map and guides you with turn instructions and voice prompts – with an offline map even without a connection.')}</p><button class="primary" type="button" id="wk-new">＋ ${L('Ersten Spaziergang anlegen','Create your first walk')}</button>${dests().length?`<p class="small" style="margin-top:14px">${L('Oder direkt für eine Station:','Or straight for a stop:')}</p><div class="wk-quick">${dests().slice(0,12).map(d=>`<button type="button" class="secondary" data-wk-quick="${h(d.id)}">${h(d.name)}</button>`).join('')}</div>`:''}</div>`+sightsHtml(null)+offlineHtml()+settingsHtml();bindStatic();renderOffline();initSights(null);return;}
  const opts=`<option value="">${L('– keine –','– none –')}</option>`+dests().map(d=>`<option value="${h(d.id)}" ${w.dest===d.id?'selected':''}>${h(d.name)}</option>`).join('');
  box.innerHTML=head+`<div class="wk-grid"><div class="wk-side panel">
    <label class="wk-title">${L('Name','Name')}<input id="wk-title" maxlength="100" value="${h(w.title)}"></label>
    <div class="wk-row"><label>${L('Station','Stop')}<select id="wk-dest">${opts}</select></label><label>${L('Datum','Date')}<input type="date" id="wk-date" value="${h(w.date)}"></label></div>
    <div class="wk-row wk-checks"><label class="checkbox-label"><input type="checkbox" id="wk-loop" ${w.loop?'checked':''}>${L('Rundweg (zurück zum Start)','Round trip (back to start)')}</label><label class="checkbox-label"><input type="checkbox" id="wk-here" ${w.fromHere?'checked':''}>${L('Navigation startet an meiner Position','Navigation starts at my position')}</label></div>
    <h4>${L('Punkte','Stops')} <span class="small" id="wk-count">${w.stops.length}</span></h4>
    <ol class="wk-stops" id="wk-stops">${stopsHtml(w)}</ol>
    <div class="wk-search"><input id="wk-search" type="search" autocomplete="off" placeholder="${h(L('Ort, Adresse oder Sehenswürdigkeit suchen …','Search place, address or sight …'))}" aria-label="${h(L('Punkt suchen','Search stop'))}"><ul id="wk-results" class="wk-results" hidden></ul></div>
    <div class="wk-tools"><button type="button" class="secondary" id="wk-me">📍 ${L('Meine Position','My position')}</button><button type="button" class="secondary" id="wk-pickbtn" aria-pressed="${picking}">＋ ${L('Auf Karte antippen','Tap on map')}</button>${sightsSource(w)?`<button type="button" class="secondary" id="wk-sights">★ ${L('Sehenswürdigkeiten übernehmen','Add sights')}</button>`:''}${w.stops.length>=3?`<button type="button" class="secondary" id="wk-opt">⇅ ${L('Reihenfolge optimieren','Optimise order')}</button>`:''}</div>
    <div id="wk-summary" class="wk-summary"></div>
    <div class="wk-actions"><button type="button" class="primary" id="wk-go">▶ ${L('Navigation starten','Start navigation')}</button><button type="button" class="secondary" id="wk-recalc">↻ ${L('Neu berechnen','Recalculate')}</button><button type="button" class="secondary" id="wk-gpx">GPX</button><button type="button" class="danger-btn" id="wk-del">${L('Löschen','Delete')}</button></div>
    <details class="wk-steps" id="wk-steps"><summary>${L('Wegbeschreibung','Directions')}</summary><ol id="wk-steplist"></ol></details>
  </div><div class="wk-mapwrap"><div id="wk-maphost"></div><div class="wk-mapbar"><span id="wk-mapsrc" class="small"></span><button type="button" class="secondary" id="wk-locate" title="${h(L('Meine Position zeigen','Show my position'))}">⌖</button></div><p id="wk-pickhint" class="wk-pickhint" ${picking?'':'hidden'}>${L('Tippe auf die Karte, um einen Punkt hinzuzufügen.','Tap the map to add a stop.')}</p></div></div>`+sightsHtml(w)+offlineHtml()+settingsHtml();
  bindStatic();bindWalk(w);mountMap(w);renderSummary();renderOffline();loadRoute(false);initSights(w);}
function stopsHtml(w){if(!w.stops.length)return `<li class="wk-nostop small">${L('Noch keine Punkte. Suche einen Ort, nutze deine Position oder tippe auf die Karte.','No stops yet. Search for a place, use your position or tap the map.')}</li>`;
  return w.stops.map((s,i)=>`<li data-stop="${h(s.id)}"><span class="wk-num">${i+1}</span><span class="wk-sname">${h(s.name)}</span><span class="wk-sbtn"><button type="button" class="secondary reorder" data-stop-act="up" ${i===0?'disabled':''} aria-label="${h(L('Nach oben','Move up'))}">↑</button><button type="button" class="secondary reorder" data-stop-act="down" ${i===w.stops.length-1?'disabled':''} aria-label="${h(L('Nach unten','Move down'))}">↓</button><button type="button" class="secondary reorder" data-stop-act="ext" aria-label="${h(L('In anderer App öffnen','Open in another app'))}">↗</button><button type="button" class="secondary reorder" data-stop-act="del" aria-label="${h(L('Entfernen','Remove'))}">✕</button></span></li>`).join('');}
function renderSummary(){const box=q('#wk-summary');if(!box)return;const w=current();if(!w)return;let html='';
  if(routeState==='loading')html=`<p class="small">${L('Fußweg wird berechnet …','Calculating walking route …')}</p>`;
  else if(routeState==='one')html=`<p class="small">${L('Ein Punkt – mit „Navigation starten“ führt dich die App von deiner Position dorthin. Für einen Spaziergang weitere Punkte hinzufügen.','One stop – “Start navigation” guides you there from your position. Add more stops for a walk.')}</p>`;
  else if(routeState==='offline')html=`<p class="small wk-warn">${L('Offline: Der Weg wird berechnet, sobald du wieder online bist. Gespeicherte Wege bleiben ohne Netz nutzbar.','Offline: the route will be calculated once you are back online. Saved routes keep working without a connection.')}</p>`;
  else if(routeState.startsWith('error:'))html=`<p class="small wk-warn">⚠ ${h(routeState.slice(6))}</p>`;
  if(route){const legs=route.legs.map((l,i)=>`<li><span>${h(w.stops[i]?.name||'')} → ${h((w.stops[i+1]||w.stops[0])?.name||'')}</span><span>${W.fmtDist(l.distance)} · ${W.fmtDur(l.duration)}</span></li>`).join('');
    html=`<div class="wk-sum"><div><strong>${W.fmtDist(route.distance)}</strong><span>${L('Strecke','Distance')}</span></div><div><strong>${W.fmtDur(route.duration)}</strong><span>${L('Gehzeit','Walking time')}</span></div><div><strong>${w.stops.length}</strong><span>${L('Punkte','Stops')}</span></div></div>${route.legs.length>1?`<ul class="wk-legs">${legs}</ul>`:''}<p class="small">${L('Berechnet von','Calculated by')} ${h(W.ENGINES[route.engine]?.label||route.engine)} · ${new Date(route.at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · ${L('auf diesem Gerät gespeichert','saved on this device')}</p>`+html;}
  else if(w.stops.length>=2&&!routeState.startsWith('error')&&routeState!=='loading'&&routeState!=='offline')html+=`<p class="small">${L('Luftlinie','Straight line')}: ${W.fmtDist(W.straightLength(w.stops,w.loop))}</p>`;
  box.innerHTML=html;const list=q('#wk-steplist');if(list)list.innerHTML=route?route.steps.map(s=>`<li><span class="wk-arrow">${arrow(s)}</span><span>${h(W.instruction(s))}</span><span class="small">${s.dist>0?W.fmtDist(s.dist):''}</span></li>`).join(''):'';
  const go=q('#wk-go');if(go)go.disabled=!w.stops.length;}
function arrow(s){if(s.type==='arrive')return '⚑';if(s.type==='waypoint')return '◉';if(s.type==='roundabout'||s.type==='exit roundabout')return '⟳';return {left:'←',right:'→','slight left':'↖','slight right':'↗','sharp left':'↙','sharp right':'↘',uturn:'↶'}[s.mod]||'↑';}
/* ---------- Bedienung ---------- */
function bindStatic(){qa('#wk-new').forEach(b=>b.onclick=()=>newWalk());const sel=q('#wk-select');if(sel)sel.onchange=()=>{cur=sel.value;LS.set('cur',cur);route=null;render();};
  qa('[data-wk-quick]').forEach(b=>b.onclick=()=>{const d=trip().destinations.find(x=>x.id===b.dataset.wkQuick);newWalk(d);});
  const ef=q('#wk-engine-form');if(ef){ef.onchange=()=>{LS.set('engine',ef.elements.engine.value);LS.set('voice',ef.elements.voice.checked?'1':'0');renderSettingsHint();if(current())loadRoute(false);};
    ef.elements.key.onchange=()=>{LS.set('orsKey',ef.elements.key.value.trim());renderSettingsHint();if(current())loadRoute(false);};}
  const fi=q('#wk-packfile');if(fi)fi.onchange=async()=>{const f=fi.files[0];fi.value='';if(!f)return;try{const p=await M.importFile(f);toast(L('Kartenpaket gespeichert: ','Map package saved: ')+p.name);renderOffline();refreshMap();}catch(e){toast(e.message);}};}
async function newWalk(d){const n=walks().length+1;const w=TravelCore.walk({id:uid(),title:d?L('Spaziergang ','Walk ')+d.name:L('Spaziergang ','Walk ')+n,dest:d?.id||'',date:d?.start||'',loop:false,fromHere:true,stops:[],created:new Date().toISOString()});await save(w);route=null;render();q('#wk-search')?.focus();}
function bindWalk(w){const upd=async patch=>{const next=TravelCore.walk({...current(),...patch});await save(next);return next;};
  q('#wk-title').onchange=async e=>{await upd({title:e.target.value});const o=q(`#wk-select option[value="${CSS.escape(w.id)}"]`);if(o)o.textContent=e.target.value;};
  q('#wk-dest').onchange=async e=>{const next=await upd({dest:e.target.value});render();if(next.dest&&!next.stops.length){const d=trip().destinations.find(x=>x.id===next.dest);if(d&&map)map.jumpTo({center:[d.lng,d.lat],zoom:14});}};
  q('#wk-date').onchange=e=>upd({date:e.target.value});
  q('#wk-loop').onchange=async e=>{await upd({loop:e.target.checked});route=null;loadRoute(false);};
  q('#wk-here').onchange=e=>upd({fromHere:e.target.checked});
  q('#wk-stops').onclick=async e=>{const b=e.target.closest('[data-stop-act]');if(!b)return;const id=b.closest('[data-stop]').dataset.stop,cw=current(),st=cw.stops.slice(),i=st.findIndex(s=>s.id===id);if(i<0)return;const act=b.dataset.stopAct;
    if(act==='ext'){externalDialog(st[i].name,st[i].lat,st[i].lng);return;}
    if(act==='up'&&i>0)[st[i-1],st[i]]=[st[i],st[i-1]];if(act==='down'&&i<st.length-1)[st[i+1],st[i]]=[st[i],st[i+1]];if(act==='del')st.splice(i,1);
    await upd({stops:st});refreshStops();};
  q('#wk-search').oninput=e=>{clearTimeout(searchTimer);const v=e.target.value.trim();if(v.length<3){hideResults();return;}searchTimer=setTimeout(()=>search(v),380);};
  q('#wk-search').onkeydown=e=>{if(e.key==='Escape')hideResults();if(e.key==='Enter'){e.preventDefault();const f=q('#wk-results li[data-i]');f&&f.click();}};
  q('#wk-results').onclick=e=>{const li=e.target.closest('li[data-i]');if(!li)return;const r=lastResults[+li.dataset.i];hideResults();q('#wk-search').value='';addStop(r.name,r.lat,r.lng);};
  q('#wk-me').onclick=()=>here().then(p=>addStop(L('Mein Standort','My location'),p[0],p[1])).catch(e=>toast(e.message));
  q('#wk-pickbtn').onclick=()=>{picking=!picking;q('#wk-pickbtn').setAttribute('aria-pressed',picking);q('#wk-pickhint').hidden=!picking;if(map)map.getCanvas().style.cursor=picking?'crosshair':'';};
  q('#wk-sights')&&(q('#wk-sights').onclick=()=>sightsDialog());
  q('#wk-opt')&&(q('#wk-opt').onclick=async()=>{const cw=current();const st=W.optimize(cw.stops,cw.loop);const before=W.straightLength(cw.stops,cw.loop),after=W.straightLength(st,cw.loop);if(after>=before-1){toast(L('Die Reihenfolge ist schon günstig.','The order is already efficient.'));return;}await upd({stops:st});refreshStops();toast(L('Reihenfolge optimiert – Luftlinie ','Order optimised – straight line ')+W.fmtDist(before)+' → '+W.fmtDist(after));});
  q('#wk-recalc').onclick=()=>loadRoute(true);
  q('#wk-gpx').onclick=()=>{const cw=current();const name=(cw.title||'spaziergang').toLowerCase().replace(/[^a-z0-9äöüß]+/gi,'-').replace(/^-|-$/g,'')+'.gpx';TravelStore.download(name,W.gpx(cw,route),'application/gpx+xml');};
  q('#wk-del').onclick=async()=>{const cw=current();const ok=await confirmAction(L('Spaziergang löschen?','Delete walk?'),L(`„${cw.title}“ mit ${cw.stops.length} Punkten wird gelöscht.`,`“${cw.title}” with ${cw.stops.length} stops will be deleted.`),[{label:L('Abbrechen','Cancel'),value:false},{label:L('Löschen','Delete'),value:true,className:'danger-btn'}]);if(!ok)return;cur=null;LS.set('cur','');await commit({...trip(),walks:walks().filter(x=>x.id!==cw.id)},false);route=null;render();};
  q('#wk-go').onclick=()=>startNav();
  q('#wk-locate').onclick=()=>here().then(p=>{showUser(p,lastFix?.acc);map&&map.easeTo({center:[p[1],p[0]],zoom:Math.max(map.getZoom(),15)});}).catch(e=>toast(e.message));}
async function addStop(name,lat,lng){const cw=current();if(!cw)return;if(cw.stops.length>=25){toast(L('Höchstens 25 Punkte pro Spaziergang.','At most 25 stops per walk.'));return;}const st=[...cw.stops,{id:uid(),name:String(name||L('Punkt','Point')).slice(0,120),lat,lng}];await save(TravelCore.walk({...cw,stops:st}));refreshStops();if(map&&st.length===1)map.easeTo({center:[lng,lat],zoom:15});}
function refreshStops(){const w=current();q('#wk-stops').innerHTML=stopsHtml(w);q('#wk-count').textContent=w.stops.length;const tools=q('.wk-tools');if(tools&&!q('#wk-opt')&&w.stops.length>=3){const b=document.createElement('button');b.type='button';b.className='secondary';b.id='wk-opt';b.textContent='⇅ '+L('Reihenfolge optimieren','Optimise order');tools.append(b);bindWalk(w);}
  route=null;routeState='';drawStops();renderSummary();drawRoute();scheduleRoute();ensurePackFor(w);if(sg.list)renderSights();}
/* ---------- Suche (Photon / komoot, OpenStreetMap-Daten); offline: eigene Orte ---------- */
let lastResults=[];
function hideResults(){const u=q('#wk-results');if(u){u.hidden=true;u.innerHTML='';}}
async function search(v){const u=q('#wk-results');if(!u)return;const c=center();let out=[];
  const local=[...dests().map(d=>({name:d.name,sub:L('Station deiner Reise','Stop on your trip'),lat:d.lat,lng:d.lng})),...walks().flatMap(w=>w.stops.map(s=>({name:s.name,sub:w.title,lat:s.lat,lng:s.lng})))].filter(x=>x.name.toLowerCase().includes(v.toLowerCase())).slice(0,4);
  if(navigator.onLine){try{searchCtl?.abort();searchCtl=new AbortController();const url=`https://photon.komoot.io/api/?q=${encodeURIComponent(v)}&limit=7&lang=${LG()}${c?`&lat=${c[0].toFixed(4)}&lon=${c[1].toFixed(4)}`:''}`;const r=await fetch(url,{signal:searchCtl.signal});const j=await r.json();
      out=(j.features||[]).map(f=>{const p=f.properties||{},g=f.geometry.coordinates;const street=[p.street,p.housenumber].filter(Boolean).join(' ');const name=p.name||street||p.city||v;const sub=[p.name&&street?street:'',[p.postcode,p.city||p.town||p.village].filter(Boolean).join(' '),p.country].filter(Boolean).join(', ');return {name,sub,lat:g[1],lng:g[0]};});}
    catch(e){if(e.name==='AbortError')return;}}
  lastResults=[...local,...out];if(q('#wk-search').value.trim()!==v)return;
  u.innerHTML=lastResults.length?lastResults.map((r,i)=>`<li data-i="${i}" tabindex="0"><strong>${h(r.name)}</strong><span class="small">${h(r.sub||'')}${c?' · '+W.fmtDist(W.dist(c,[r.lat,r.lng])):''}</span></li>`).join(''):`<li class="small">${navigator.onLine?L('Nichts gefunden.','Nothing found.'):L('Offline – nur eigene Orte durchsuchbar.','Offline – only your own places can be searched.')}</li>`;u.hidden=false;}
function center(){const w=current();if(lastFix)return [lastFix.lat,lastFix.lng];if(map){const c=map.getCenter();return [c.lat,c.lng];}if(w?.stops[0])return [w.stops[0].lat,w.stops[0].lng];const d=trip().destinations.find(x=>x.id===w?.dest);return d&&d.lat!==null?[d.lat,d.lng]:null;}
/* ---------- Sehenswürdigkeiten der Station übernehmen ---------- */
function sightsSource(w){const d=trip().destinations.find(x=>x.id===w.dest);if(!d||d.lat===null)return null;const texts=[d.sights||''];for(const day of d.planning?.days||[])for(const t of day.excursions||[])texts.push(t.title||'',t.sights||'');
  const seen=new Set(),names=[];for(const line of texts.join('\n').split(/\n|;|•|·|\|/)){const s=line.replace(/^\s*(?:[-–*]|\d+[.)])\s*/,'').replace(/\s*\(.*?\)\s*$/,'').trim();if(s.length<3||s.length>80||/^https?:/i.test(s))continue;const k=s.toLowerCase();if(seen.has(k))continue;seen.add(k);names.push(s);}
  return names.length?{dest:d,names:names.slice(0,25)}:null;}
async function sightsDialog(){const w=current(),src=sightsSource(w);if(!src)return;if(!navigator.onLine){toast(L('Zum Suchen der Orte wird Internet gebraucht.','Finding the places needs an internet connection.'));return;}
  const dlg=document.createElement('dialog');dlg.className='wk-dialog';dlg.setAttribute('data-no-i18n','');dlg.innerHTML=`<h3>${L('Sehenswürdigkeiten von','Sights of')} ${h(src.dest.name)}</h3><p class="small">${L('Aus deinen Notizen zur Station. Die Orte werden in der Nähe der Station gesucht – bitte prüfen.','From your notes for this stop. Places are searched near the stop – please check.')}</p><ul class="wk-found">${src.names.map((n,i)=>`<li data-i="${i}"><label class="checkbox-label"><input type="checkbox" disabled><span><strong>${h(n)}</strong><span class="small" data-found>${L('wird gesucht …','searching …')}</span></span></label></li>`).join('')}</ul><div class="card-actions"><button type="button" class="secondary" data-x>${L('Abbrechen','Cancel')}</button><button type="button" class="primary" data-ok disabled>${L('Übernehmen','Add')}</button></div>`;
  document.body.append(dlg);dlg.showModal();let stop=false;const found=[];dlg.querySelector('[data-x]').onclick=()=>{stop=true;dlg.close();dlg.remove();};
  dlg.querySelector('[data-ok]').onclick=async()=>{const sel=[...dlg.querySelectorAll('li')].filter(li=>li.querySelector('input').checked).map(li=>found[+li.dataset.i]).filter(Boolean);stop=true;dlg.close();dlg.remove();for(const r of sel)await addStop(r.name,r.lat,r.lng);};
  for(let i=0;i<src.names.length&&!stop;i++){const li=dlg.querySelector(`li[data-i="${i}"]`);try{const r=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(src.names[i])}&limit=1&lang=${LG()}&lat=${src.dest.lat}&lon=${src.dest.lng}`);const j=await r.json();const f=(j.features||[])[0];
      if(f){const g=f.geometry.coordinates,d=W.dist([src.dest.lat,src.dest.lng],[g[1],g[0]]);if(d<40000){const p=f.properties;found[i]={name:src.names[i],lat:g[1],lng:g[0]};const dup=current().stops.some(s=>s.name.toLowerCase()===src.names[i].toLowerCase()||W.dist([s.lat,s.lng],[g[1],g[0]])<25);li.querySelector('input').disabled=false;li.querySelector('input').checked=!dup;li.querySelector('[data-found]').textContent=[p.name,p.street,p.city].filter(Boolean).join(', ')+' · '+W.fmtDist(d)+' '+L('von der Station','from the stop')+(dup?' · '+L('schon im Spaziergang','already in this walk'):'');}else li.querySelector('[data-found]').textContent=L('nur weit entfernt gefunden – übersprungen','only found far away – skipped');}
      else li.querySelector('[data-found]').textContent=L('nicht gefunden','not found');}catch{li.querySelector('[data-found]').textContent=L('Suche fehlgeschlagen','search failed');}
    dlg.querySelector('[data-ok]').disabled=!found.some(Boolean);await new Promise(r=>setTimeout(r,250));}}
/* ---------- Position ---------- */
function here(){return new Promise((res,rej)=>{if(!navigator.geolocation)return rej(Error(L('Dieses Gerät kann keine Position bestimmen.','This device cannot determine its position.')));if(lastFix&&Date.now()-lastFix.t<15000)return res([lastFix.lat,lastFix.lng]);
  navigator.geolocation.getCurrentPosition(p=>{lastFix={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,t:Date.now()};res([lastFix.lat,lastFix.lng]);},e=>rej(Error(e.code===1?L('Standortzugriff wurde nicht erlaubt. In den Browser-Einstellungen freigeben.','Location access was not allowed. Allow it in the browser settings.'):L('Position nicht verfügbar.','Position unavailable.'))),{enableHighAccuracy:true,timeout:15000,maximumAge:10000});});}
/* ---------- Karte ---------- */
const dark=()=>document.documentElement.dataset.theme==='dark';
async function packFor(w){const p=w.stops[0]||null;if(p)return M.forPoint(p.lat,p.lng);const d=trip().destinations.find(x=>x.id===w.dest);if(d&&d.lat!==null)return M.forPoint(d.lat,d.lng);return null;}
let mapEl=null;
async function mountMap(w){const host=q('#wk-maphost');if(!host)return;if(!mapEl){mapEl=document.createElement('div');mapEl.id='wk-map';mapEl.className='wk-map';}if(!nav)host.append(mapEl);
  try{await M.loadLibs();}catch(e){mapEl.innerHTML=`<p class="small" style="padding:16px">${h(e.message)}</p>`;return;}
  const pack=await packFor(w);if(!map||(pack?.id||null)!==(mapPack?.id||null)){await buildMap(pack,w);}else{map.resize();drawStops();drawRoute();fitWalk(w);}}
async function buildMap(pack,w){const st=await M.style({pack,dark:dark()});mapPack=pack||null;
  if(map)map.setStyle(st,{diff:false});
  else{let c=[10,51],z=4;const d=trip().destinations.find(x=>x.id===w?.dest);if(w?.stops[0]){c=[w.stops[0].lng,w.stops[0].lat];z=15;}else if(d&&d.lat!==null){c=[d.lng,d.lat];z=14;}else if(pack){c=[(pack.bbox[0]+pack.bbox[2])/2,(pack.bbox[1]+pack.bbox[3])/2];z=13;}
    map=new maplibregl.Map({container:mapEl,style:st,center:c,zoom:z,attributionControl:{compact:true},maxPitch:0,dragRotate:true,touchPitch:false});
    map.addControl(new maplibregl.NavigationControl({showCompass:true,visualizePitch:false}),'top-right');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
    /* nach jedem Stilwechsel (online/offline) Weg-Ebenen neu anlegen */
    map.on('style.load',()=>{addOverlays();drawRoute();if(nav&&nav.route){route=nav.route;drawRoute();}});
    map.on('click',e=>{if(nav||!picking)return;picking=false;const b=q('#wk-pickbtn');if(b)b.setAttribute('aria-pressed','false');const hint=q('#wk-pickhint');if(hint)hint.hidden=true;map.getCanvas().style.cursor='';tapAdd(e.lngLat.lat,e.lngLat.lng);});
    map.on('dragstart',()=>{if(nav){nav.follow=false;q('#wkn-center')?.removeAttribute('hidden');}});
    map.on('error',e=>{/* fehlende Kacheln/Schriften offline: nicht stören */});}
  const src=q('#wk-mapsrc');if(src)src.textContent=pack?'🗺 '+L('Offline-Karte: ','Offline map: ')+(EN()&&pack.name_en||pack.name):(navigator.onLine?L('Online-Karte (OpenStreetMap)','Online map (OpenStreetMap)'):L('Offline – nur schon angesehene Kartenteile','Offline – only previously viewed map areas'));
  drawStops();drawRoute();fitWalk(w);}
async function refreshMap(){const w=current();if(!w||!map)return;const pack=await packFor(w);if((pack?.id||null)!==(mapPack?.id||null))await buildMap(pack,w);}
async function ensurePackFor(w){if(map)refreshMap();}
async function tapAdd(lat,lng){let name=L('Punkt ','Point ')+(current().stops.length+1);if(navigator.onLine){try{const r=await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=${LG()}`);const j=await r.json();const p=j.features?.[0]?.properties;if(p)name=p.name||[p.street,p.housenumber].filter(Boolean).join(' ')||name;}catch{}}addStop(name,lat,lng);}
function addOverlays(){if(!map||map.getSource('wk-route'))return;const empty={type:'FeatureCollection',features:[]};
  map.addSource('wk-route',{type:'geojson',data:empty});map.addSource('wk-done',{type:'geojson',data:empty});
  map.addLayer({id:'wk-route-casing',type:'line',source:'wk-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffffff','line-width':9,'line-opacity':0.9}});
  map.addLayer({id:'wk-route-line',type:'line',source:'wk-route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#188b85','line-width':5.5}});
  map.addLayer({id:'wk-done-line',type:'line',source:'wk-done',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#8a9497','line-width':5.5}});}
function drawRoute(){if(!map||!map.getSource('wk-route'))return;const fc=route?{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.coords.map(c=>[c[1],c[0]])}}]}:{type:'FeatureCollection',features:[]};map.getSource('wk-route').setData(fc);if(!nav)map.getSource('wk-done').setData({type:'FeatureCollection',features:[]});}
function drawStops(){if(!map)return;drawSightMarkers();markers.forEach(m=>m.remove());markers=[];const w=current();if(!w)return;w.stops.forEach((s,i)=>{const el=document.createElement('div');el.className='wk-pin';el.textContent=i+1;el.title=s.name;markers.push(new maplibregl.Marker({element:el}).setLngLat([s.lng,s.lat]).addTo(map));});}
function fitWalk(w){if(!map||!w||!w.stops.length)return;if(w.stops.length===1){map.jumpTo({center:[w.stops[0].lng,w.stops[0].lat],zoom:Math.max(map.getZoom(),15)});return;}const lats=w.stops.map(s=>s.lat),lngs=w.stops.map(s=>s.lng);map.fitBounds([[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]],{padding:50,maxZoom:16,duration:0});}
function showUser(p,acc,heading){if(!map)return;if(!userMarker){const el=document.createElement('div');el.className='wk-me';el.innerHTML='<span class="wk-me-cone"></span><span class="wk-me-dot"></span>';userMarker=new maplibregl.Marker({element:el,rotationAlignment:'map'}).setLngLat([p[1],p[0]]).addTo(map);}else userMarker.setLngLat([p[1],p[0]]);
  const el=userMarker.getElement();el.classList.toggle('has-heading',Number.isFinite(heading));if(Number.isFinite(heading))userMarker.setRotation(heading);el.classList.toggle('weak',acc>50);}
/* ---------- Andere Navi-Apps ---------- */
function externalDialog(name,lat,lng,destId){const l=W.links(lat,lng,name),android=/Android/i.test(navigator.userAgent),apple=/iPhone|iPad|Macintosh/.test(navigator.userAgent);
  const dlg=document.createElement('dialog');dlg.className='wk-dialog';dlg.setAttribute('data-no-i18n','');dlg.innerHTML=`<h3>🚶 ${L('Zu Fuß zu','Walk to')} ${h(name)}</h3><div class="wk-ext"><button type="button" class="primary" data-own>${L('Mit Reiseatelier navigieren','Navigate with Reiseatelier')}</button><a class="secondary btn-link" href="${h(l.google)}" target="_blank" rel="noopener">Google Maps</a>${apple||!android?`<a class="secondary btn-link" href="${h(l.apple)}" target="_blank" rel="noopener">${L('Apple Karten','Apple Maps')}</a>`:''}${android?`<a class="secondary btn-link" href="${h(l.geo)}">${L('Andere Navi-App','Other navigation app')}</a>`:''}</div><p class="small">${L('Google Maps und Apple Karten brauchen Internet. Reiseatelier funktioniert mit gespeichertem Weg und Offline-Karte auch ohne.','Google Maps and Apple Maps need internet. Reiseatelier also works without, using a saved route and an offline map.')}</p><div class="card-actions"><button type="button" class="secondary" data-x>${L('Schließen','Close')}</button></div>`;
  document.body.append(dlg);dlg.showModal();const close=()=>{dlg.close();dlg.remove();};dlg.querySelector('[data-x]').onclick=close;dlg.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setTimeout(close,50)));
  dlg.querySelector('[data-own]').onclick=async()=>{close();await walkTo(name,lat,lng,destId);};}
async function walkTo(name,lat,lng,destId){const w=TravelCore.walk({id:uid(),title:L('Zu ','To ')+name,dest:destId||'',date:'',loop:false,fromHere:true,stops:[{id:uid(),name,lat,lng}],created:new Date().toISOString()});await save(w);route=null;if(location.hash!=='#zufuss')location.hash='#zufuss';else render();setTimeout(()=>startNav(),120);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-walk-to]');if(!b)return;e.preventDefault();const d=trip().destinations.find(x=>x.id===b.dataset.walkTo);if(d&&d.lat!==null)externalDialog(d.name,d.lat,d.lng,d.id);});
/* ---------- Navigation ---------- */
let wakeLock=null;
async function lockScreen(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
document.addEventListener('visibilitychange',()=>{if(nav&&document.visibilityState==='visible')lockScreen();});
function speak(text){if(!voiceOn()||!('speechSynthesis' in window)||!text)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=EN()?'en-GB':'de-DE';u.rate=1;speechSynthesis.speak(u);}catch{}}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p);}catch{}}
let compass=null;function onOrient(e){let hd=null;if(Number.isFinite(e.webkitCompassHeading))hd=e.webkitCompassHeading;else if(e.absolute&&Number.isFinite(e.alpha))hd=(360-e.alpha)%360;if(hd!==null){compass=hd;if(nav&&!nav.moving)applyHeading(hd);}}
async function startCompass(){try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const r=await DeviceOrientationEvent.requestPermission();if(r!=='granted')return;}}catch{return;}window.addEventListener('deviceorientationabsolute',onOrient);window.addEventListener('deviceorientation',onOrient);}
function stopCompass(){window.removeEventListener('deviceorientationabsolute',onOrient);window.removeEventListener('deviceorientation',onOrient);}
async function startNav(){const w=current();if(!w||!w.stops.length)return;if(!navigator.geolocation){toast(L('Dieses Gerät kann keine Position bestimmen.','This device cannot determine its position.'));return;}
  startCompass();lockScreen();
  nav={walk:w,route:null,hint:null,off:0,said:{},lastReroute:0,follow:true,headingUp:LS.get('headingUp','0')==='1',moving:false,along:0,done:false,started:Date.now(),pending:!!(w.fromHere||w.stops.length<2),reached:w.fromHere||w.stops.length<2?0:1,legStart:1};
  if(!nav.pending)nav.route=route;
  openOverlay();setCard('…',L('Warte auf GPS-Position …','Waiting for GPS position …'));
  if(!nav.pending&&!nav.route){try{const {points,names}=routePoints(w);nav.route=await fetchRoute(points,names);route=nav.route;drawRoute();}catch(e){setWarn(e.message);}}
  nav.watch=navigator.geolocation.watchPosition(onFix,e=>setWarn(e.code===1?L('Standortzugriff wurde nicht erlaubt.','Location access was not allowed.'):L('Kein GPS-Signal …','No GPS signal …')),{enableHighAccuracy:true,maximumAge:1000,timeout:30000});}
/* Weg von der aktuellen Position über die noch offenen Punkte (beim Rundweg zurück zum ersten Punkt) */
async function routeFromHere(p){const w=nav.walk,k=Math.min(nav.reached||0,w.stops.length),rest=w.stops.slice(k);const points=[p,...rest.map(s=>[s.lat,s.lng])],names=[L('Mein Standort','My location'),...rest.map(s=>s.name)];
  if(w.loop&&w.stops.length>1){points.push([w.stops[0].lat,w.stops[0].lng]);names.push(w.stops[0].name);}
  if(points.length<2){nav.direct=true;return;}nav.lastReroute=Date.now();
  try{const r=await fetchRoute(points,names);if(!nav)return;nav.route=r;nav.direct=false;nav.hint=null;nav.said={first:1};nav.lastKey=-1;nav.off=0;nav.along=0;nav.legStart=k;setWarn('');drawNavRoute();}
  catch(e){if(!nav)return;setWarn(e.offline?L('Offline – keine neue Route möglich. Folge dem Pfeil zum nächsten Punkt.','Offline – cannot reroute. Follow the arrow to the next stop.'):e.message);if(!nav.route)nav.direct=true;}}
function drawNavRoute(){if(!map||!nav)return;route=nav.route;drawRoute();}
function onFix(pos){if(!nav)return;const p=[pos.coords.latitude,pos.coords.longitude],acc=pos.coords.accuracy||99,spd=pos.coords.speed;lastFix={lat:p[0],lng:p[1],acc,t:Date.now()};
  nav.moving=Number.isFinite(spd)&&spd>0.6;const hd=nav.moving&&Number.isFinite(pos.coords.heading)?pos.coords.heading:compass;showUser(p,acc,hd);if(nav.moving&&Number.isFinite(pos.coords.heading))applyHeading(pos.coords.heading);
  if(nav.follow&&map)map.easeTo({center:[p[1],p[0]],zoom:Math.max(map.getZoom(),17),duration:600});
  q('#wkn-acc').textContent=acc>50?L('GPS ungenau (±','GPS inaccurate (±')+Math.round(acc)+' m)':'';
  if(nav.pending){if(acc>150)return;nav.pending=false;if(navigator.onLine)routeFromHere(p).then(()=>nav&&onFix(pos));else if(route){nav.route=route;nav.legStart=1;nav.reached=1;setWarn(L('Offline – gespeicherter Weg ab dem ersten Punkt.','Offline – using the saved route from the first stop.'));}else{nav.route=null;nav.direct=true;setWarn(L('Offline – kein Weg ab deiner Position. Der Pfeil zeigt die Richtung zum nächsten Punkt.','Offline – no route from your position. The arrow points towards the next stop.'));}return;}
  const r=nav.route;if(!r||nav.direct){direct(p);return;}
  const loc=W.locate(r,p,nav.hint);if(!loc)return;nav.hint=loc.seg;
  const offLimit=Math.max(30,Math.min(60,acc*0.8+12));if(loc.d>offLimit&&acc<60)nav.off++;else nav.off=0;
  if(nav.off>=3){if(navigator.onLine&&Date.now()-nav.lastReroute>20000){speak(L('Neue Route wird berechnet.','Recalculating.'));setWarn(L('Vom Weg abgekommen – neue Route wird berechnet …','Off route – recalculating …'));routeFromHere(p);}else if(!navigator.onLine){setWarn(L('Vom Weg abgekommen: ','Off route: ')+W.fmtDist(loc.d)+L(' zur Route',' to the route'));}}
  else if(loc.d<offLimit)setWarn('');
  if(loc.along<nav.along-60&&loc.d>15){}else nav.along=Math.max(loc.along,nav.along-20);
  const along=nav.along;q('#wk-map')&&map.getSource('wk-done')&&map.getSource('wk-done').setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:W.slice(r,0,along).map(c=>[c[1],c[0]])}});
  /* erreichte Punkte zählen (für eine spätere Neuberechnung ab hier) */
  r.legs.forEach((l,i)=>{if(along>=l.along-18)nav.reached=Math.max(nav.reached||0,nav.legStart+i+1);});
  const step=W.nextStep(r,along);if(!step)return;const d=Math.max(0,step.along-along),key=r.steps.indexOf(step);
  /* bei großen Positionssprüngen übersprungene Zwischenziele trotzdem melden */
  for(let i=Math.max(0,nav.lastKey??0);i<key;i++){const s=r.steps[i];if(s.type==='waypoint'&&!nav.said[i+'n']){nav.said[i+'n']=1;speak(W.instruction(s));buzz(120);}}nav.lastKey=key;
  setCard(arrow(step),W.instruction(step),d);
  const remaining=Math.max(0,r.length-along),secs=r.length?r.duration*remaining/r.length:0;
  q('#wkn-remain').textContent=W.fmtDist(remaining)+' · '+W.fmtDur(secs)+' · '+L('an ','arr. ')+new Date(Date.now()+secs*1000).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  const nextLeg=r.legs.find(l=>l.along>along+5);const ns=nextLeg?r.steps.find(s=>(s.type==='waypoint'||s.type==='arrive')&&s.along>=nextLeg.along-1):null;q('#wkn-next').textContent=ns&&ns.stop?L('Nächster Punkt: ','Next stop: ')+ns.stop+' · '+W.fmtDist(Math.max(0,nextLeg.along-along)):'';
  if(!nav.said.first){nav.said.first=1;const first=r.steps.find(s=>s.type==='depart');speak(first&&d>80?W.instruction(first):W.spoken(step,d));}
  if(d<=80&&d>25&&!nav.said[key+'f']){nav.said[key+'f']=1;speak(W.spoken(step,d));}
  if(d<=22&&!nav.said[key+'n']){nav.said[key+'n']=1;nav.said[key+'f']=1;buzz(step.type==='arrive'?[200,100,200]:120);
    if(step.type==='arrive'){speak(W.instruction(step));arrived(step);}else speak(step.type==='waypoint'?W.instruction(step):W.spoken(step,d));}}
function direct(p){const w=nav.walk,i=Math.min(nav.reached||0,w.stops.length-1),s=w.stops[i],d=W.dist(p,[s.lat,s.lng]),b=W.bearing(p,[s.lat,s.lng]);
  setCard('➤',L('Luftlinie zu ','Straight line to ')+s.name,d,b-(nav.headingUp&&map?map.getBearing():0));
  if(d<25&&!nav.said['d'+i]){nav.said['d'+i]=1;speak((i===w.stops.length-1?L('Ziel erreicht: ','You have arrived: '):L('Zwischenziel erreicht: ','Stop reached: '))+s.name);buzz(150);nav.reached=i+1;if(i===w.stops.length-1)arrived({stop:s.name});}}
function arrived(step){nav.done=true;q('#wkn-card').classList.add('arrived');q('#wkn-remain').textContent=L('Gesamt: ','Total: ')+W.fmtDur((Date.now()-nav.started)/1000);}
function applyHeading(hd){if(!nav||!map||!nav.headingUp||!nav.follow)return;map.easeTo({bearing:hd,duration:400});}
function setCard(icon,text,d,rot){const c=q('#wkn-card');if(!c)return;q('#wkn-icon').textContent=icon;q('#wkn-icon').style.transform=Number.isFinite(rot)?`rotate(${rot-90}deg)`:'';q('#wkn-text').textContent=text;q('#wkn-dist').textContent=Number.isFinite(d)?W.fmtDist(d):'';}
function setWarn(t){const e=q('#wkn-warn');if(e){e.textContent=t||'';e.hidden=!t;}}
function openOverlay(){let o=q('#wk-nav');if(!o){o=document.createElement('div');o.id='wk-nav';o.setAttribute('data-no-i18n','');document.body.append(o);}
  o.innerHTML=`<div class="wkn-maphost" id="wkn-maphost"></div><div class="wkn-card" id="wkn-card" role="status" aria-live="polite"><span class="wkn-icon" id="wkn-icon">↑</span><div><div class="wkn-dist" id="wkn-dist"></div><div class="wkn-text" id="wkn-text"></div></div></div><p class="wkn-warn" id="wkn-warn" hidden></p><div class="wkn-bar"><div><div id="wkn-remain" class="wkn-remain"></div><div id="wkn-next" class="small"></div><div id="wkn-acc" class="small wk-warn"></div></div><div class="wkn-btns"><button type="button" class="secondary" id="wkn-center" hidden title="${h(L('Zentrieren','Re-centre'))}">⌖</button><button type="button" class="secondary" id="wkn-orient" title="${h(L('Ausrichtung','Orientation'))}">${nav.headingUp?'🧭':'N↑'}</button><button type="button" class="secondary" id="wkn-voice" title="${h(L('Sprachansagen','Voice prompts'))}">${voiceOn()?'🔊':'🔇'}</button><button type="button" class="danger-btn" id="wkn-stop">✕ ${L('Beenden','End')}</button></div></div>`;
  o.hidden=false;document.documentElement.classList.add('wk-navigating');q('#wkn-maphost').append(mapEl);setTimeout(()=>map&&map.resize(),50);
  q('#wkn-stop').onclick=stopNav;q('#wkn-voice').onclick=e=>{LS.set('voice',voiceOn()?'0':'1');e.target.textContent=voiceOn()?'🔊':'🔇';if(!voiceOn())try{speechSynthesis.cancel();}catch{}};
  q('#wkn-orient').onclick=e=>{nav.headingUp=!nav.headingUp;LS.set('headingUp',nav.headingUp?'1':'0');e.target.textContent=nav.headingUp?'🧭':'N↑';if(!nav.headingUp)map.easeTo({bearing:0});else if(compass!==null)applyHeading(compass);};
  q('#wkn-center').onclick=e=>{nav.follow=true;e.target.hidden=true;if(lastFix)map.easeTo({center:[lastFix.lng,lastFix.lat],zoom:17});};
  history.pushState({wkNav:1},'');}
window.addEventListener('popstate',()=>{if(nav)stopNav(true);});
function stopNav(fromPop){if(!nav)return;try{navigator.geolocation.clearWatch(nav.watch);}catch{}stopCompass();try{wakeLock&&wakeLock.release();}catch{}wakeLock=null;try{speechSynthesis.cancel();}catch{}nav=null;
  const o=q('#wk-nav');if(o)o.hidden=true;document.documentElement.classList.remove('wk-navigating');const host=q('#wk-maphost');if(host&&mapEl)host.append(mapEl);if(map){map.getSource('wk-done')?.setData({type:'FeatureCollection',features:[]});map.easeTo({bearing:0,duration:0});setTimeout(()=>map.resize(),50);}
  if(fromPop!==true&&history.state&&history.state.wkNav)history.back();loadRoute(false);}

/* ---------- Sehenswürdigkeiten in der Nähe (Wikidata) ---------- */
const S=window.TravelSights;let sg={key:'',list:null,state:'',filter:'all',shown:12,at:0,over:null},sightMarkers=[];
const sgKm=()=>+LS.get('sightsKm','2')||2,sgMap=()=>LS.get('sightsMap','1')==='1';
function nextDest(){const ds=dests();if(!ds.length)return null;const pick=LS.get('sightsDest','');const f=ds.find(d=>d.id===pick);if(f)return f;const t=new Date().toISOString().slice(0,10);return ds.find(d=>(d.end||d.start||'')>=t)||ds[0];}
function sgCenter(w){if(sg.over)return sg.over;if(w){const d=trip().destinations.find(x=>x.id===w.dest);if(d&&d.lat!==null)return {lat:d.lat,lng:d.lng,label:d.name,dest:d};if(w.stops[0])return {lat:w.stops[0].lat,lng:w.stops[0].lng,label:w.stops[0].name};return null;}const d=nextDest();return d?{lat:d.lat,lng:d.lng,label:d.name,dest:d}:null;}
function sightsHtml(w){if(!S)return '';const c=sgCenter(w);if(!c&&!w)return '';
  const sel=!w&&dests().length>1?`<label class="wk-sg-dest">${L('Station','Stop')}<select id="wk-sg-dest">${dests().map(d=>`<option value="${h(d.id)}" ${c&&c.dest&&c.dest.id===d.id?'selected':''}>${h(d.name)}</option>`).join('')}</select></label>`:'';
  return `<section class="panel wk-sights" id="wk-sights-panel"><div class="wk-sg-head"><div><h3>★ ${L('Sehenswürdigkeiten in der Nähe','Sights nearby')}</h3><p class="small" id="wk-sg-where"></p></div><div class="wk-sg-ctrl">${sel}<label>${L('Umkreis','Radius')}<select id="wk-sg-km">${[1,2,5].map(k=>`<option value="${k}" ${sgKm()===k?'selected':''}>${k} km</option>`).join('')}</select></label>${w?`<button type="button" class="secondary" id="wk-sg-here" title="${h(L('Im aktuellen Kartenausschnitt suchen','Search the current map view'))}">⌖ ${L('Hier suchen','Search here')}</button>`:''}<button type="button" class="secondary" id="wk-sg-reload" title="${h(L('Neu laden','Reload'))}">↻</button></div></div>
  <div class="wk-sg-chips" id="wk-sg-chips"></div><div id="wk-sg-body"><p class="small">…</p></div>
  <p class="small wk-sg-src">${L('Daten','Data')}: <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> (CC0) · ${L('Fotos','Photos')}: <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> · ${L('Sortiert nach Bekanntheit – ohne Gewähr, Öffnungszeiten bitte vor Ort prüfen.','Sorted by popularity – no guarantee, please check opening hours locally.')}</p></section>`;}
function initSights(w){const p=q('#wk-sights-panel');if(!p)return;
  q('#wk-sg-km').onchange=e=>{LS.set('sightsKm',e.target.value);loadSights(false);};
  q('#wk-sg-reload').onclick=()=>loadSights(true);
  const ds=q('#wk-sg-dest');if(ds)ds.onchange=e=>{LS.set('sightsDest',e.target.value);sg.over=null;loadSights(false);};
  const hb=q('#wk-sg-here');if(hb)hb.onclick=()=>{if(!map)return;const c=map.getCenter();sg.over={lat:c.lat,lng:c.lng,label:L('Kartenausschnitt','map view')};loadSights(false);};
  p.onclick=sgClick;loadSights(false);}
async function loadSights(force){const w=current(),c=sgCenter(w),body=q('#wk-sg-body');if(!body)return;
  if(!c){body.innerHTML=`<p class="small">${L('Füge einen Punkt hinzu oder wähle eine Station, dann erscheinen hier Sehenswürdigkeiten.','Add a stop or choose a station and sights will appear here.')}</p>`;q('#wk-sg-chips').innerHTML='';sg.list=null;drawSightMarkers();return;}
  const key=`${c.lat.toFixed(3)},${c.lng.toFixed(3)}|${sgKm()}|${LG()}`;q('#wk-sg-where').textContent=L('um ','around ')+c.label+' · '+sgKm()+' km';
  if(!force&&sg.key===key&&sg.list){renderSights();return;}
  sg.key=key;sg.shown=12;sg.state='loading';body.innerHTML=`<p class="small">${L('Sehenswürdigkeiten werden geladen …','Loading sights …')}</p>`;
  try{const r=await S.load(c.lat,c.lng,sgKm(),LG(),{force});if(sg.key!==key)return;sg.list=r.list;sg.at=r.at;sg.state='ok';}
  catch(e){if(sg.key!==key)return;sg.list=null;sg.state='error';body.innerHTML=`<p class="small wk-warn">${h(e.message)}</p>`;q('#wk-sg-chips').innerHTML='';drawSightMarkers();return;}
  renderSights();}
const inWalk=s=>{const w=current();return !!w&&w.stops.some(x=>x.name===s.name||W.dist([x.lat,x.lng],[s.lat,s.lng])<30);};
function sgFiltered(){const l=sg.list||[];return sg.filter==='all'?l:l.filter(s=>s.cat===sg.filter);}
function renderSights(){const body=q('#wk-sg-body');if(!body||!sg.list)return;const l=sg.list;
  const cats=[{id:'all',icon:'',de:'Alle',en:'All'},...S.CATS,{id:'other',icon:'•',de:'Sonstiges',en:'Other'}].filter(c=>c.id==='all'||l.some(s=>s.cat===c.id));
  q('#wk-sg-chips').innerHTML=cats.map(c=>`<button type="button" class="wk-chip" data-sg-filter="${c.id}" aria-pressed="${sg.filter===c.id}">${c.icon?c.icon+' ':''}${h(EN()?c.en:c.de)} <span>${c.id==='all'?l.length:l.filter(s=>s.cat===c.id).length}</span></button>`).join('');
  const f=sgFiltered();if(!l.length){body.innerHTML=`<p class="small">${L('In diesem Umkreis wurde nichts gefunden. Größeren Umkreis wählen?','Nothing found within this radius. Try a larger radius?')}</p>`;drawSightMarkers();return;}
  const icon=c=>(S.CATS.find(x=>x.id===c)||{icon:'•'}).icon;
  const cards=f.slice(0,sg.shown).map(s=>{const iw=inWalk(s);return `<article class="wk-sg-card${iw?' in':''}" data-sg="${h(s.id)}"><div class="wk-sg-img"><span>${icon(s.cat)}</span>${s.img&&navigator.onLine?`<img loading="lazy" alt="" src="${h(s.img)}" onerror="this.remove()">`:''}</div><div class="wk-sg-txt"><strong>${h(s.name)}</strong><span class="small">${h(s.desc)}</span><span class="small">${W.fmtDist(s.dist)} ${L('entfernt','away')}</span></div><div class="wk-sg-btns"><button type="button" class="${iw?'secondary':'primary'}" data-sg-add="${h(s.id)}">${iw?'✓ '+L('Im Spaziergang','In walk'):'＋ '+L('Zum Spaziergang','Add to walk')}</button><button type="button" class="secondary" data-sg-show="${h(s.id)}" title="${h(L('Auf der Karte zeigen','Show on map'))}">◎</button><a class="secondary btn-link" href="${h(s.wiki)}" target="_blank" rel="noopener">${s.wiki.includes('wikipedia')?'Wikipedia':'Wikidata'}</a></div></article>`;}).join('');
  const more=f.length>sg.shown?`<button type="button" class="secondary" data-sg-more>${L('Weitere anzeigen','Show more')} (${f.length-sg.shown})</button>`:'';
  const top=f.filter(s=>!inWalk(s)).slice(0,5);
  body.innerHTML=`<div class="wk-sg-tools">${top.length>=2?`<button type="button" class="secondary" data-sg-top>★ ${L('Top '+top.length+' als Spaziergang übernehmen','Add top '+top.length+' to walk')}</button>`:''}${current()?`<label class="checkbox-label"><input type="checkbox" id="wk-sg-onmap" ${sgMap()?'checked':''}>${L('Auf der Karte zeigen','Show on map')}</label>`:''}</div><div class="wk-sg-grid">${cards}</div>${more}${sg.at&&!navigator.onLine?`<p class="small">${L('Offline – gespeicherte Liste vom ','Offline – saved list from ')}${new Date(sg.at).toLocaleDateString('de-DE')}</p>`:''}`;
  const om=q('#wk-sg-onmap');if(om)om.onchange=e=>{LS.set('sightsMap',e.target.checked?'1':'0');drawSightMarkers();};drawSightMarkers();}
async function sgClick(e){const t=e.target.closest('button');if(!t)return;const find=id=>(sg.list||[]).find(s=>s.id===id);
  if(t.dataset.sgFilter){sg.filter=t.dataset.sgFilter;sg.shown=12;renderSights();return;}
  if(t.hasAttribute('data-sg-more')){sg.shown+=12;renderSights();return;}
  if(t.dataset.sgShow){const s=find(t.dataset.sgShow);if(s&&map){map.easeTo({center:[s.lng,s.lat],zoom:Math.max(map.getZoom(),16)});popSight(s);q('#wk-maphost')?.scrollIntoView({behavior:'smooth',block:'center'});}return;}
  if(t.dataset.sgAdd){const s=find(t.dataset.sgAdd);if(s)await toggleSight(s);return;}
  if(t.hasAttribute('data-sg-top')){const top=sgFiltered().filter(s=>!inWalk(s)).slice(0,5);await ensureWalk();const cw=current();const st=[...cw.stops,...top.map(s=>({id:uid(),name:s.name,lat:s.lat,lng:s.lng}))].slice(0,25);await save(TravelCore.walk({...cw,stops:W.optimize(st,cw.loop)}));render();toast(L(`${top.length} Sehenswürdigkeiten übernommen – Reihenfolge optimiert.`,`${top.length} sights added – order optimised.`));}}
/* Ohne Spaziergang wird automatisch einer für die gewählte Station angelegt */
async function ensureWalk(){if(current())return false;const c=sgCenter(null),d=c&&c.dest;const w=TravelCore.walk({id:uid(),title:d?L('Spaziergang ','Walk ')+d.name:L('Spaziergang','Walk'),dest:d?.id||'',date:'',loop:false,fromHere:true,stops:[],created:new Date().toISOString()});await save(w);return true;}
async function toggleSight(s){const created=await ensureWalk();const cw=current();if(inWalk(s)){await save(TravelCore.walk({...cw,stops:cw.stops.filter(x=>!(x.name===s.name||W.dist([x.lat,x.lng],[s.lat,s.lng])<30))}));}
  else{if(cw.stops.length>=25){toast(L('Höchstens 25 Punkte pro Spaziergang.','At most 25 stops per walk.'));return;}await save(TravelCore.walk({...cw,stops:[...cw.stops,{id:uid(),name:s.name,lat:s.lat,lng:s.lng}]}));}
  if(created)render();else{refreshStops();renderSights();}}
function drawSightMarkers(){sightMarkers.forEach(m=>m.remove());sightMarkers=[];if(!map||!sg.list||!sgMap()||!current())return;
  for(const s of sgFiltered().slice(0,Math.max(sg.shown,12))){if(inWalk(s))continue;const el=document.createElement('button');el.type='button';el.className='wk-sg-pin';el.textContent=(S.CATS.find(x=>x.id===s.cat)||{icon:'★'}).icon;el.title=s.name;el.setAttribute('aria-label',s.name);
    el.addEventListener('click',ev=>{ev.stopPropagation();popSight(s);});sightMarkers.push(new maplibregl.Marker({element:el}).setLngLat([s.lng,s.lat]).addTo(map));}}
let sgPopup=null;
function popSight(s){if(!map)return;sgPopup?.remove();const box=document.createElement('div');box.className='wk-sg-pop';box.setAttribute('data-no-i18n','');const iw=inWalk(s);
  box.innerHTML=`<strong>${h(s.name)}</strong><span class="small">${h(s.desc)}</span><button type="button" class="${iw?'secondary':'primary'}">${iw?'✓ '+L('Im Spaziergang','In walk'):'＋ '+L('Zum Spaziergang','Add to walk')}</button>`;
  box.querySelector('button').onclick=async()=>{sgPopup?.remove();await toggleSight(s);};sgPopup=new maplibregl.Popup({offset:14,maxWidth:'260px'}).setLngLat([s.lng,s.lat]).setDOMContent(box).addTo(map);}
/* ---------- Offline-Karten ---------- */
function offlineHtml(){return `<section class="panel wk-offline" id="wk-offline"><h3>🗺 ${L('Offline-Karten','Offline maps')}</h3><p class="small">${L('Ein Kartenpaket enthält eine Stadt mit allen Straßen und Wegen. Einmal geladen, funktioniert die Karte im Tab „Zu Fuß“ ohne Internet – zusammen mit vorher berechneten Wegen auch die Navigation. Am besten im WLAN laden.','A map package contains a city with all its streets and paths. Once downloaded, the map on the “On foot” tab works without internet – and, with routes calculated beforehand, so does navigation. Best downloaded over Wi-Fi.')}</p><div id="wk-packs"><p class="small">…</p></div><div class="wk-packfile"><label class="secondary btn-link">${L('Kartenpaket aus Datei laden (.pmtiles)','Load map package from file (.pmtiles)')}<input type="file" id="wk-packfile" accept=".pmtiles,application/octet-stream" hidden></label><span class="small" id="wk-usage"></span></div></section>`;}
async function renderOffline(){const box=q('#wk-packs');if(!box)return;const [cat,have]=await Promise.all([M.catalog(),M.list()]);const haveIds=new Set(have.map(p=>p.id));const ds=dests();
  const fits=p=>ds.some(d=>M.contains(p.bbox,d.lat,d.lng))||walks().some(w=>w.stops.some(s=>M.contains(p.bbox,s.lat,s.lng)));
  const name=p=>EN()&&p.name_en||p.name;const rows=[];
  for(const p of have)rows.push(`<li data-pack="${h(p.id)}"><div><strong>${h(name(p))}</strong>${fits(p)?` <span class="badge fertig">${L('passt zur Reise','fits your trip')}</span>`:''}<span class="small">${M.mb(p.size)} · ${p.source==='file'?L('aus Datei','from file'):L('Stand ','data as of ')+h(p.date||p.saved?.slice(0,10)||'')} · ${L('auf diesem Gerät','on this device')}</span></div><button type="button" class="danger-btn" data-pack-del="${h(p.id)}">${L('Entfernen','Remove')}</button></li>`);
  const avail=(cat.packs||[]).filter(p=>!haveIds.has(p.id)).sort((a,b)=>(fits(b)-fits(a))||name(a).localeCompare(name(b)));
  for(const p of avail)rows.push(`<li data-pack="${h(p.id)}"><div><strong>${h(name(p))}</strong>${fits(p)?` <span class="badge fertig">${L('passt zur Reise','fits your trip')}</span>`:''}<span class="small">${p.size?M.mb(p.size):''}${p.date?' · '+L('Stand ','data as of ')+h(p.date):''}</span><progress hidden max="1" value="0"></progress></div><button type="button" class="secondary" data-pack-get="${h(p.id)}" ${navigator.onLine?'':'disabled'}>⬇ ${L('Laden','Download')}</button></li>`);
  let note='';if(cat.missing)note=L('Auf dieser Seite gibt es noch keine Kartenpakete. Sie werden von der GitHub Action „Seite und Kartenpakete“ erzeugt (siehe Anleitung).','There are no map packages on this site yet. They are created by the GitHub Action “Site and map packages” (see the guide).');else if(cat.offline&&!have.length)note=L('Offline – die Liste der Kartenpakete ist gerade nicht abrufbar.','Offline – the list of map packages is not available right now.');
  box.innerHTML=(rows.length?`<ul class="wk-packlist">${rows.join('')}</ul>`:'')+(note?`<p class="small">${note}</p>`:'');
  box.querySelectorAll('[data-pack-get]').forEach(b=>b.onclick=()=>getPack(b.dataset.packGet,cat));box.querySelectorAll('[data-pack-del]').forEach(b=>b.onclick=async()=>{const p=have.find(x=>x.id===b.dataset.packDel);const ok=await confirmAction(L('Kartenpaket entfernen?','Remove map package?'),L(`„${name(p)}“ (${M.mb(p.size)}) wird von diesem Gerät gelöscht.`,`“${name(p)}” (${M.mb(p.size)}) will be deleted from this device.`),[{label:L('Abbrechen','Cancel'),value:false},{label:L('Entfernen','Remove'),value:true,className:'danger-btn'}]);if(!ok)return;await M.remove(p.id);renderOffline();refreshMap();});
  const u=await M.usage();const ue=q('#wk-usage');if(ue&&u)ue.textContent=L('Speicher belegt: ','Storage used: ')+M.mb(u.used)+(u.quota?' '+L('von','of')+' '+M.mb(u.quota):'')+(u.persisted?' · '+L('dauerhaft','persistent'):'');}
async function getPack(id,cat){if(dl){toast(L('Es wird schon ein Kartenpaket geladen.','A map package is already downloading.'));return;}const e=cat.packs.find(p=>p.id===id);if(!e)return;const li=q(`#wk-packs li[data-pack="${CSS.escape(id)}"]`),bar=li?.querySelector('progress'),btn=li?.querySelector('button');
  dl=new AbortController();if(bar)bar.hidden=false;if(btn){btn.textContent=L('Abbrechen','Cancel');btn.onclick=()=>dl&&dl.abort();}
  try{await M.download({...e,build:cat.build},(got,total)=>{if(bar){bar.max=total||1;bar.value=got;}if(btn&&total)btn.textContent=Math.round(got/total*100)+' % · '+L('Abbrechen','Cancel');},dl.signal);toast(L('Offline-Karte gespeichert: ','Offline map saved: ')+(EN()&&e.name_en||e.name));refreshMap();}
  catch(err){if(err.name!=='AbortError')toast(err.message.includes('Quota')||err.name==='QuotaExceededError'?L('Nicht genug Speicherplatz auf dem Gerät.','Not enough storage on this device.'):err.message);}
  finally{dl=null;renderOffline();}}
/* ---------- Einstellungen ---------- */
function settingsHtml(){const e=LS.get('engine','fossgis');return `<details class="panel wk-settings"><summary>${L('Einstellungen fürs Navi','Navigation settings')}</summary><form id="wk-engine-form" onsubmit="return false"><fieldset><legend>${L('Routing-Dienst','Routing service')}</legend><label class="checkbox-label"><input type="radio" name="engine" value="fossgis" ${e!=='ors'?'checked':''}>${L('FOSSGIS-Routingserver (OSRM) – ohne Anmeldung','FOSSGIS routing server (OSRM) – no sign-up')}</label><label class="checkbox-label"><input type="radio" name="engine" value="ors" ${e==='ors'?'checked':''}>${L('openrouteservice – mit eigenem kostenlosem Schlüssel','openrouteservice – with your own free key')}</label><label>${L('openrouteservice-Schlüssel','openrouteservice key')}<input name="key" autocomplete="off" spellcheck="false" value="${h(LS.get('orsKey',''))}" placeholder="${h(L('nur für openrouteservice','only for openrouteservice'))}"></label></fieldset><label class="checkbox-label"><input type="checkbox" name="voice" ${voiceOn()?'checked':''}>${L('Sprachansagen während der Navigation','Voice prompts during navigation')}</label><p class="small" id="wk-engine-hint"></p></form></details>`;}
function renderSettingsHint(){const e=q('#wk-engine-hint');if(!e)return;const sel=LS.get('engine','fossgis');e.innerHTML=sel==='ors'&&!LS.get('orsKey','')?L('Ohne Schlüssel wird weiter der FOSSGIS-Server benutzt. Schlüssel kostenlos unter <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noopener">openrouteservice.org</a>. Er bleibt nur auf diesem Gerät.','Without a key the FOSSGIS server is used. Get a free key at <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noopener">openrouteservice.org</a>. It stays on this device only.'):L('Der FOSSGIS-Server wird ehrenamtlich betrieben (höchstens eine Anfrage pro Sekunde, keine Verfügbarkeitsgarantie). Wege, Punkte und Suchbegriffe werden zur Berechnung an den gewählten Dienst bzw. an Photon (komoot) gesendet.','The FOSSGIS server is run by volunteers (at most one request per second, no availability guarantee). Routes, stops and search terms are sent to the chosen service or to Photon (komoot) for processing.');}
window.TravelWalk={show(){render();renderSettingsHint();},onTrip(){if(location.hash==='#zufuss'&&!nav)render();},walkTo,homeLine(){const n=walks().length;return n?n+' '+(n===1?L('Spaziergang','walk'):L('Spaziergänge','walks')):L('Noch kein Spaziergang','No walk yet');}};
})();
