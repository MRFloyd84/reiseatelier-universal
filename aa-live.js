'use strict';
/* Deutsche Auslandsvertretungen live von der OpenData-Schnittstelle des Auswärtigen Amts.
   Nutzungsbedingungen des AA: Daten vollständig übernehmen, über die Schnittstelle aktuell halten, Quelle nennen.
   Deshalb: Abruf beim Öffnen des Notfall-Tabs (höchstens alle 3 Tage, oder per Knopf), Zwischenspeicher für offline,
   Quelle und Abrufdatum werden angezeigt. Klappt der Abruf nicht (offline, Browser blockiert, Format geändert),
   nutzt die App die hinterlegten Vertretungen bzw. den Link zum Auswärtigen Amt.
   Die Auswertung ist bewusst tolerant: Sie sucht in der Antwort nach Einträgen mit Titel und Telefonnummer,
   statt sich auf eine feste Struktur zu verlassen (das AA hat das Format 2023 geändert). */
(function(root){
const URL_AA='https://www.auswaertiges-amt.de/opendata/representativesInCountry';
const KEY='rau.aa.missions.v1',MAX_AGE=3*86400000;
const fold=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/ß/g,'ss').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const strip=v=>String(v??'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#?\w+;/g,' ').replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').trim();
let names=null;
function nameIndex(){if(names)return names;names=new Map();const codes=root.TravelCore?.codes||[];for(const l of ['de','en']){let dn;try{dn=new Intl.DisplayNames([l],{type:'region'});}catch{continue;}for(const c of codes){try{names.set(fold(dn.of(c)),c);}catch{}}}
  /* Amtliche deutsche Kurz- und Langformen, die von Intl abweichen */
  const extra={'vereinigte staaten von amerika':'US','vereinigte staaten':'US','usa':'US','vereinigtes konigreich':'GB','grossbritannien':'GB','russische foderation':'RU','republik korea':'KR','korea republik':'KR','demokratische volksrepublik korea':'KP','volksrepublik china':'CN','kongo demokratische republik':'CD','demokratische republik kongo':'CD','kongo republik':'CG','republik kongo':'CG','cote d ivoire':'CI','elfenbeinkuste':'CI','turkei':'TR','turkiye':'TR','tschechische republik':'CZ','tschechien':'CZ','iran islamische republik':'IR','moldau':'MD','republik moldau':'MD','nordmazedonien':'MK','vietnam':'VN','laos':'LA','syrien':'SY','vatikanstadt':'VA','heiliger stuhl':'VA','palastinensische gebiete':'PS','hongkong':'HK','macau':'MO','taiwan':'TW','kosovo':'XK','myanmar':'MM','eswatini':'SZ','osttimor':'TL','timor leste':'TL','kap verde':'CV','cabo verde':'CV','bosnien und herzegowina':'BA','st lucia':'LC','st vincent und die grenadinen':'VC','st kitts und nevis':'KN','sao tome und principe':'ST','zentralafrikanische republik':'CF','vereinigte arabische emirate':'AE','saudi arabien':'SA','brunei darussalam':'BN','mikronesien':'FM','salomonen':'SB','antigua und barbuda':'AG','trinidad und tobago':'TT','dominikanische republik':'DO','aquatorialguinea':'GQ','sudsudan':'SS','sudafrika':'ZA','sudkorea':'KR','nordkorea':'KP'};
  for(const [k,v] of Object.entries(extra))names.set(k,v);return names;}
function ccOf(v){if(!v)return '';const s=String(v).trim();if(/^[A-Z]{2}$/.test(s))return s;const idx=nameIndex();const f=fold(strip(s));if(idx.has(f))return idx.get(f);
  for(const [k,c] of idx)if(k.length>4&&(f.startsWith(k+' ')||f.endsWith(' '+k)))return c;return '';}
const isPhoneKey=k=>/tele|phone|^fon|^tel$|^f$|rufnummer/i.test(k)&&!/fax/i.test(k);
const isEmergKey=k=>/notfall|emergency|bereitschaft|notruf|after.?hours|ausserhalb|aus?erhalb/i.test(k);
const isTitleKey=k=>/^(title|titel|bezeichnung|name|designation|type)$/i.test(k);
const isCountryKey=k=>/^(country|land|countryname|countrycode|iso2|iso2countrycode|staat)$/i.test(k);
const isCityKey=k=>/^(city|ort|stadt|location|sitz)$/i.test(k);
const isAreaKey=k=>/amtsbezirk|konsularbezirk|district|zustandig|zuständig|jurisdiction/i.test(k);
/* Sucht Telefonnummern in Texten wie „+66 (0) 2287 9000“. */
const PHONE_RE=/\+?\d[\d ()\/.-]{6,}\d/g;
function phones(v){return [...strip(v).matchAll(PHONE_RE)].map(m=>m[0].replace(/\s+/g,' ').trim()).filter(p=>p.replace(/\D/g,'').length>=7);}
function parse(json){const out=[];const seen=new Set();
  function walk(node,ctx,depth){if(!node||typeof node!=='object'||depth>12)return;
    if(Array.isArray(node)){for(const x of node)walk(x,ctx,depth+1);return;}
    const keys=Object.keys(node);let cc=ctx.cc;
    for(const k of keys){if(isCountryKey(k)&&typeof node[k]==='string'){const c=ccOf(node[k]);if(c){cc=c;break;}}}
    const titleKey=keys.find(k=>isTitleKey(k)&&typeof node[k]==='string');
    /* Kontaktfelder direkt am Eintrag oder eine Ebene tiefer (z. B. „contact“: {…}) */
    const fields=[];for(const k of keys){const v=node[k];if(typeof v==='string')fields.push([k,v]);else if(v&&typeof v==='object'&&!Array.isArray(v))for(const [k2,v2] of Object.entries(v))if(typeof v2==='string')fields.push([k2,v2]);}
    const phoneVals=fields.filter(([k])=>isPhoneKey(k)&&!isEmergKey(k)).map(([,v])=>v),emergVals=fields.filter(([k])=>isEmergKey(k)).map(([,v])=>v);
    if(titleKey&&(phoneVals.length||emergVals.length)){
      let phone=phoneVals.flatMap(phones)[0]||'';let emergency=emergVals.flatMap(phones)[0]||'';
      /* Notfallnummer steckt manchmal im Freitext („Notfälle außerhalb der Öffnungszeiten: +…“) */
      if(!emergency)for(const [,v] of fields){const m=/notf(?:a|ä)ll[^+\d]{0,80}(\+?\d[\d ()\/.-]{6,}\d)/i.exec(strip(v));if(m){emergency=m[1].trim();break;}}
      const cityKey=keys.find(k=>isCityKey(k)&&typeof node[k]==='string');const areaKey=keys.find(k=>isAreaKey(k)&&typeof node[k]==='string');
      const title=strip(node[titleKey]),city=cityKey?strip(node[cityKey]):'';
      const id=[cc,title,city,phone].join('|');
      if(cc&&!seen.has(id)){seen.add(id);out.push({cc,title,city,phone,emergency:emergency&&emergency!==phone?emergency:'',area:areaKey?strip(node[areaKey]).slice(0,400):'',leader:strip(node.leader||node.leitung||'').slice(0,120)});}}
    for(const k of keys)if(node[k]&&typeof node[k]==='object')walk(node[k],{cc},depth+1);}
  walk(json,{cc:''},0);return out;}
function rank(m){const t=fold(m.title);return /botschaft|embassy/.test(t)?0:/generalkonsulat|consulate general/.test(t)?1:/konsulat/.test(t)&&!/honorar/.test(t)?2:/honorar/.test(t)?4:3;}
function group(list){const by={};for(const m of list)(by[m.cc]||(by[m.cc]=[])).push(m);for(const k in by)by[k].sort((a,b)=>rank(a)-rank(b));return by;}

let cache=null,inflight=null,lastError='';
function load(){if(cache)return cache;try{cache=JSON.parse(localStorage.getItem(KEY)||'null');}catch{cache=null;}return cache;}
async function refresh(force=false){const c=load();if(!force&&c&&Date.now()-c.fetched<MAX_AGE)return c;if(!navigator.onLine){lastError='offline';return c;}if(inflight)return inflight;
  inflight=(async()=>{try{const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);const r=await fetch(URL_AA,{signal:ctl.signal,cache:'no-cache'});clearTimeout(t);
      if(!r.ok)throw Error('HTTP '+r.status);const json=await r.json();const list=parse(json);if(list.length<20)throw Error('Unerwartetes Format');
      cache={fetched:Date.now(),count:list.length,by:group(list)};try{localStorage.setItem(KEY,JSON.stringify(cache));}catch{}lastError='';root.dispatchEvent(new CustomEvent('aa-missions-updated'));return cache;}
    catch(e){lastError=e.name==='TypeError'?'blocked':e.name==='AbortError'?'timeout':(e.message||'error');return c;}finally{inflight=null;}})();
  return inflight;}
function status(){const c=load();return {fetched:c?.fetched||null,count:c?.count||0,error:lastError};}
function forCountry(cc){const c=load();return c?.by?.[cc]||null;}
root.AAMissions={refresh,status,forCountry,parse,URL:URL_AA};
})(globalThis);
