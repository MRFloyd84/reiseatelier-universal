'use strict';
/* Reiseatelier – Speicherschicht.
   Alles liegt auf diesem Gerät (IndexedDB). Jede Reise hat ihren eigenen Bereich „trips/<id>“ mit Route, Tagebuch,
   Fotos, Sicherungen und Abgleich-Zeitstempeln. Ein Verzeichnis („registry“) merkt sich alle Reisen und die geöffnete.
   Eigene Datenbank- und Schlüsselnamen, damit die App neben anderen Reiseatelier-Versionen auf derselben Domain läuft. */
(function(root){
const DB_NAME='reiseatelier-universal',LS='rau.';
let tripId=null,registry=null,kvStore=null;
const DRAFT=()=>LS+'pending.'+tripId,SYNC_STATUS=()=>LS+'sync.'+tripId;
const CHUNK=80000,MAX_BACKUPS=15;
let revision=0,meta=null,tail=Promise.resolve(),pending=0,blocked=false,mode=null,base=null,remoteRev=0,dl=null,initP=null;
const C=()=>root.TravelCore;
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,k)=>(a[k]=v[k],a),{}):v);
const rand=()=>Math.random().toString(36).slice(2,8);
const stamp=()=>new Date().toISOString();
function slug(){const t=(registry?.list.find(x=>x.id===tripId)?.title||'reise').toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);return t||'reise';}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function withTimeout(p,ms,msg){let t;return Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej(Error(msg)),ms);})]).finally(()=>clearTimeout(t));}
async function retry(fn){try{return await fn();}catch(e){if(e&&e.code==='unavailable'){await sleep(400+Math.random()*600);return fn();}throw e;}}
function errText(e){if(!e)return 'Unbekannter Fehler.';if(e.code==='quota_exceeded')return 'Speicherplatz ist voll. Bitte Reise exportieren und alte Fotos entfernen.';if(e.code==='invalid_argument')return 'Keine Schreibrechte für diese Reise.';if(e.code==='revoked'||e.code==='not_granted')return 'Kein Zugriff mehr auf den Cloud-Speicher. Seite neu öffnen.';return e.message||String(e);}
function split(json){const out=[];let i=0;while(i<json.length){let end=Math.min(i+CHUNK,json.length);const c=json.charCodeAt(end-1);if(end<json.length&&c>=0xD800&&c<=0xDBFF)end--;out.push(json.slice(i,end));i=end;}return out.length?out:[''];}

/* ---------- Gerätespeicher mit derselben Schnittstelle wie der Cloud-Speicher ---------- */
function makeKV(){
  let dbp=null;const mem=new Map();
  try{if(root.indexedDB)dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}catch{dbp=null;}
  const tx=async(m,fn)=>{const db=await dbp;return new Promise((res,rej)=>{const t=db.transaction('kv',m),s=t.objectStore('kv'),r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error||Error('Gerätespeicher-Fehler'));t.onabort=()=>rej(t.error||Error('Gerätespeicher voll'));});};
  const ok=async()=>{if(!dbp)return false;try{await dbp;return true;}catch{return false;}};
  return {
    async get(k){if(await ok())return tx('readonly',s=>s.get(k));if(mem.has(k))return mem.get(k);try{const v=localStorage.getItem(LS+'kv.'+k);return v?JSON.parse(v):undefined;}catch{return undefined;}},
    async set(k,v){if(await ok())return tx('readwrite',s=>s.put(v,k));mem.set(k,v);try{localStorage.setItem(LS+'kv.'+k,JSON.stringify(v));}catch{}},
    async del(k){if(await ok())return tx('readwrite',s=>s.delete(k));mem.delete(k);try{localStorage.removeItem(LS+'kv.'+k);}catch{}},
    async keys(){if(await ok())return tx('readonly',s=>s.getAllKeys());const out=new Set(mem.keys());try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(LS+'kv.'))out.add(k.slice(LS.length+3));}}catch{}return [...out];},
  };
}
function localDoc(kv,path){
  const snap=(id,v)=>({id,exists:v!==undefined,data:()=>v,metadata:{fromCache:false,hasPendingWrites:false}});
  const id=path.split('/').pop();
  return {id,path,
    async get(){return snap(id,await kv.get(path));},
    async set(v){await kv.set(path,JSON.parse(JSON.stringify(v)));},
    async update(v){const cur=await kv.get(path);await kv.set(path,{...(cur||{}),...v});},
    async delete(){await kv.del(path);},
    onSnapshot(){return ()=>{};},
    collection(c){return localCol(kv,path+'/'+c);}};
}
function localCol(kv,path,order){
  const depth=path.split('/').length+1;
  const run=async()=>{const ks=(await kv.keys()).filter(k=>k.startsWith(path+'/')&&k.split('/').length===depth);let docs=[];for(const k of ks){const v=await kv.get(k);if(v!==undefined)docs.push({id:k.split('/').pop(),exists:true,data:()=>v,metadata:{fromCache:false,hasPendingWrites:false}});}
    if(order){const [f,dir]=order;docs.sort((a,b)=>String(a.data()[f]).localeCompare(String(b.data()[f]))*(dir==='desc'?-1:1));}else docs.sort((a,b)=>a.id.localeCompare(b.id));
    return {docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false}};};
  return {path,doc:id=>localDoc(kv,path+'/'+(id||crypto.randomUUID())),get:run,orderBy:(f,dir)=>localCol(kv,path,[f,dir]),onSnapshot(){return ()=>{};}};
}

/* ---------- Datei speichern ohne Claude: Teilen-Menü (iPhone/iPad: „In Dateien sichern“) oder normaler Download ---------- */
/* Teilen-Menü bevorzugen, damit die Datei direkt in iCloud Drive, Google Drive, OneDrive usw. landet.
   iPhone/iPad/Mac: „In Dateien sichern“. Android: „In Drive speichern“ – Chrome auf Android teilt nur bestimmte
   Dateitypen, daher notfalls als .txt (die App liest beide). Sonst normaler Download. */
const IS_ANDROID=/Android/i.test(navigator.userAgent),IS_APPLE_TOUCH=/iPhone|iPad|Macintosh/.test(navigator.userAgent)&&'ontouchend' in document;
async function saveFile(filename,text,type='application/json'){const blob=new Blob([text],{type});
  const candidates=[[filename,type]];if(IS_ANDROID&&/\.json$/.test(filename))candidates.push([filename.replace(/\.json$/,'.txt'),'text/plain']);
  if((IS_APPLE_TOUCH||IS_ANDROID)&&navigator.canShare){for(const [name,t] of candidates){let file;try{file=new File([text],name,{type:t});}catch{continue;}if(!navigator.canShare({files:[file]}))continue;
    try{await navigator.share({files:[file],title:name});return true;}
    catch(e){if(e&&e.name==='AbortError')return false;
      if(e&&e.name==='NotAllowedError'&&typeof confirmAction==='function'){/* Vorbereitung hat zu lange gedauert: erneut antippen lassen */
        const go=await confirmAction('Datei ist bereit',`„${name}“ (${Math.max(1,Math.round(text.length/1024))} KB) kann jetzt gesichert werden. Im Teilen-Menü ${IS_ANDROID?'„In Drive speichern“ (oder eine andere Cloud-App)':'„In Dateien sichern“'} wählen.`,[{label:'Abbrechen',value:false},{label:'Jetzt sichern',value:true,className:'primary'}]);
        if(!go)return false;try{await navigator.share({files:[new File([text],name,{type:t})],title:name});return true;}catch(e2){if(e2&&e2.name==='AbortError')return false;}}
      break;}}}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;}
/* ---------- Start: Reiseverzeichnis laden, geöffnete Reise wählen ---------- */
const newId=()=>'t'+Date.now().toString(36)+rand();
async function saveRegistry(){await kvStore.set('registry',registry);}
async function init(){
  if(initP)return initP;
  initP=(async()=>{
    kvStore=makeKV();try{navigator.storage?.persist?.();}catch{}
    registry=await kvStore.get('registry');
    if(!registry||!Array.isArray(registry.list))registry={active:null,list:[]};
    if(!registry.list.length){const id=newId();registry.list.push({id,title:'',type:'rundreise',created:stamp()});registry.active=id;await saveRegistry();}
    if(!registry.list.some(t=>t.id===registry.active)){registry.active=registry.list[0].id;await saveRegistry();}
    use(registry.active);
  })();
  return initP;
}
function use(id){tripId=id;base=localDoc(kvStore,'trips/'+id);mode='device';revision=0;meta=null;}
/* Reisen verwalten. Wechseln lädt die Seite neu, damit alle Bereiche sauber mit der neuen Reise starten. */
async function keysOf(id){const p='trips/'+id;return (await kvStore.keys()).filter(k=>k===p||k.startsWith(p+'/'));}
const Trips={
  async list(){await init();return registry.list.map(t=>({...t}));},
  get active(){return tripId;},
  async create({title='',type='rundreise',id=null}={}){await init();id=id&&/^[\w-]{3,60}$/.test(id)&&!registry.list.some(t=>t.id===id)?id:newId();registry.list.push({id,title:String(title).slice(0,100),type,created:stamp()});await saveRegistry();return id;},
  async update(id,patch){await init();const t=registry.list.find(x=>x.id===id);if(!t)return;let changed=false;for(const k of ['title','type','start','end'])if(patch[k]!==undefined&&t[k]!==patch[k]){t[k]=patch[k];changed=true;}if(changed)await saveRegistry();},
  async open(id){await init();if(!registry.list.some(t=>t.id===id))throw Error('Reise nicht gefunden.');registry.active=id;await saveRegistry();location.reload();},
  /* Nur für den Abgleich: ohne Neuladen in eine (gerade angelegte) Reise wechseln. */
  async switchQuiet(id){await init();await tail;registry.active=id;await saveRegistry();use(id);},
  async duplicate(id){await init();await Store.flush();const src=registry.list.find(t=>t.id===id);if(!src)throw Error('Reise nicht gefunden.');
    const nid=await this.create({title:(src.title||'Reise')+' (Kopie)',type:src.type});const from='trips/'+id,to='trips/'+nid;
    for(const k of await keysOf(id)){const v=await kvStore.get(k);if(k.startsWith(from+'/meta/'))continue;await kvStore.set(to+k.slice(from.length),v);}
    const t=registry.list.find(x=>x.id===nid);Object.assign(t,{start:src.start,end:src.end});await saveRegistry();return nid;},
  async remove(id,{reload=true}={}){await init();for(const k of await keysOf(id))await kvStore.del(k);
    try{localStorage.removeItem(LS+'pending.'+id);localStorage.removeItem(LS+'sync.'+id);}catch{}
    registry.list=registry.list.filter(t=>t.id!==id);
    if(!registry.list.length){const nid=newId();registry.list.push({id:nid,title:'',type:'rundreise',created:stamp()});}
    if(registry.active===id)registry.active=registry.list[0].id;await saveRegistry();if(reload&&id===tripId)location.reload();},
  /* Leer = keine Stationen, kein Titel, kein Tagebuch. */
  async isEmpty(id){await init();const ks=await keysOf(id);if(ks.some(k=>k.includes('/diary/')))return false;const m=await kvStore.get('trips/'+id);if(!m)return true;
    try{const st=JSON.parse(await readParts('parts',m.key,m.parts,localDoc(kvStore,'trips/'+id)));return !(st.destinations?.length||st.settings?.title);}catch{return false;}},
};

/* ---------- Reise lesen/schreiben (in Teilstücken) ---------- */
async function readParts(col,key,n,ref=base){const snaps=await Promise.all(Array.from({length:n},(_,i)=>retry(()=>ref.collection(col).doc(key+'-'+i).get())));return snaps.map(s=>{if(!s.exists)throw Error('Gespeicherte Reisedaten sind unvollständig.');return s.data().s;}).join('');}
async function writeParts(col,key,json){const parts=split(json);for(let i=0;i<parts.length;i++)await retry(()=>base.collection(col).doc(key+'-'+i).set({s:parts[i]}));return parts.length;}
function dropParts(col,key,n){for(let i=0;i<n;i++)Promise.resolve().then(()=>base.collection(col).doc(key+'-'+i).delete()).catch(()=>{});}
async function current(){const m=await retry(()=>base.get());if(!m.exists)return {revision:0,state:C().blank(),updated_at:null,meta:null};const md=m.data();return {revision:md.revision,state:JSON.parse(await readParts('parts',md.key,md.parts)),updated_at:md.updated_at,meta:md};}
async function persist(state,cur){const rev=(cur.meta?cur.meta.revision:0)+1,key='r'+rev+'-'+rand();const n=await writeParts('parts',key,JSON.stringify(state));const md={revision:rev,key,parts:n,updated_at:stamp()};await retry(()=>base.set(md));if(cur.meta)dropParts('parts',cur.meta.key,cur.meta.parts);meta=md;return {revision:rev,updated_at:md.updated_at};}

/* ---------- Änderungszeitpunkte je Eintrag (für den Abgleich) ---------- */
const syncDoc=()=>base.collection('meta').doc('sync');
async function getStamps(){const s=await retry(()=>syncDoc().get());const v=s.exists?s.data():{};return {items:{...(v.items||{})},tomb:{...(v.tomb||{})}};}
let stampTail=Promise.resolve();
function changeStamps(fn){const job=stampTail.then(async()=>{const st=await getStamps();fn(st,stamp());await retry(()=>syncDoc().set(st));});stampTail=job.catch(()=>{});return job;}
/* Einreise-Haken werden einzeln abgeglichen (x:<aufgabe>|<person>), damit gleichzeitiges Abhaken beider Personen erhalten bleibt. */
function splitSettings(settings){const s={...(settings||{})},checks=s.entry?.checks||{};if(s.entry)s.entry={...s.entry,checks:{}};return {s,checks};}
function tripKeys(state){const m=new Map();for(const d of state.destinations||[])m.set('d:'+d.id,canonical(d));const {s,checks}=splitSettings(state.settings);m.set('s',canonical({settings:s,routeMode:state.routeMode}));for(const [k,v] of Object.entries(checks))m.set('x:'+k,v);return m;}
function stampTrip(before,after){const a=tripKeys(before),b=tripKeys(after);return changeStamps((st,now)=>{for(const [k,v] of b)if(a.get(k)!==v){st.items[k]=now;delete st.tomb[k];}for(const k of a.keys())if(!b.has(k)){st.tomb[k]=now;delete st.items[k];}});}

/* ---------- Sicherungen ---------- */
async function makeBackup(state,reason){
  const name='reiseatelier-'+slug()+'-'+reason+'-'+stamp().replace(/[:.]/g,'-')+'.json';
  const key='b'+Date.now()+'-'+rand();const n=await writeParts('bparts',key,JSON.stringify({...state,exportedAt:stamp()}));
  await retry(()=>base.collection('backups').doc(key).set({name,created:stamp(),key,parts:n}));
  const all=(await base.collection('backups').orderBy('created','desc').get()).docs;
  for(const s of all.slice(MAX_BACKUPS)){const b=s.data();dropParts('bparts',b.key,b.parts);Promise.resolve().then(()=>base.collection('backups').doc(s.id).delete()).catch(()=>{});}
  return name;
}

/* Merkt sich, wann auf diesem Gerät zuletzt etwas geändert wurde (für den Hinweis „noch nicht gespeichert“). */
function markChange(){try{const s=JSON.parse(localStorage.getItem(SYNC_STATUS())||'{}');s.changed=stamp();localStorage.setItem(SYNC_STATUS(),JSON.stringify(s));}catch{}root.dispatchEvent(new CustomEvent('travel-sync-status'));}
function draft(snapshot){try{localStorage.setItem(DRAFT(),JSON.stringify({state:snapshot,revision}));}catch{}}
function signal(){root.dispatchEvent(new CustomEvent('travel-storage-status',{detail:{pending,blocked,revision}}));}
function ids(state){const out=new Set();for(const d of state.destinations||[]){out.add('d:'+d.id);for(const day of d.planning?.days||[]){out.add('t:'+day.id);for(const t of day.excursions||[])out.add('x:'+t.id);}}return out;}

const Store={
get revision(){return revision;},get pending(){return pending;},get blocked(){return blocked;},
get mode(){return mode;},
async load(){await withTimeout(init(),20000,'Speicher antwortet nicht.');const r=await withTimeout(current(),20000,'Speicher nicht erreichbar.');revision=r.revision;meta=r.meta||null;return r.state;},
save(snapshot,confirmed=false){draft(snapshot);pending++;signal();const job=tail.then(async()=>{
  if(blocked)throw Error('Speichern angehalten. Entwurf exportieren oder wiederherstellen.');
  let cur;try{cur=await current();}catch(e){blocked=true;throw Error(errText(e));}
  if(cur.revision!==revision){if(canonical(cur.state)===canonical(snapshot)){revision=cur.revision;meta=cur.meta||null;return cur;}blocked=true;throw Error('Die Reise wurde gerade von jemand anderem oder auf einem anderen Gerät geändert. Deine letzte Änderung ist als Entwurf gesichert.');}
  const before=ids(cur.state),after=ids(snapshot);const removed=[...before].some(x=>!after.has(x));
  if(removed&&!confirmed)throw Error('Entfernen wurde nicht bestätigt.');
  try{if(removed)await makeBackup(cur.state,'vor-loeschen');const r=await persist(snapshot,cur);revision=r.revision;await stampTrip(cur.state,snapshot).catch(()=>{});markChange();return {revision,state:snapshot};}
  catch(e){blocked=true;throw Error(errText(e));}
});tail=job.catch(()=>{});return job.finally(()=>{pending--;if(!pending&&!blocked)try{localStorage.removeItem(DRAFT());}catch{}signal();});},
async flush(){await tail;if(blocked)throw Error('Nicht alle Änderungen sind gespeichert.');},
async _replace(raw,importMode,reason='vor-import'){const cur=await current();const incoming=C().validateState(raw);let next=incoming;
  if(importMode==='merge'){next=C().validateState({...cur.state,destinations:[...cur.state.destinations,...incoming.destinations.map(d=>({...d,id:crypto.randomUUID()}))]});}
  const backup=await makeBackup(cur.state,reason);const r=await persist(next,cur);revision=r.revision;await stampTrip(cur.state,next).catch(()=>{});return {revision,state:next,backup};},
async import(raw,importMode){await this.flush();const r=await this._replace(raw,importMode);markChange();return r;},
async restore(raw,importMode){await tail;const r=await this._replace(raw,importMode);markChange();blocked=false;try{localStorage.removeItem(DRAFT());}catch{}signal();return r;},
async backup(){await this.flush();const cur=await current();return {backup:await makeBackup(cur.state,'manuell')};},
async backups(){const s=await base.collection('backups').orderBy('created','desc').get();return {backups:s.docs.map(d=>({name:d.data().name,id:d.id}))};},
async backupText(id){const s=await base.collection('backups').doc(id).get();if(!s.exists)throw Error('Sicherung nicht gefunden.');const b=s.data();return readParts('bparts',b.key,b.parts);},
async exportText(){await this.flush();const cur=await current();return JSON.stringify({...cur.state,exportedAt:stamp()},null,2);},
canDownload(){return true;},
async download(filename,text,type){if(!dl)return saveFile(filename,text,type);try{await dl.save({filename,data:text});return true;}catch(e){if(e&&e.code==='declined')return false;throw Error('Datei konnte nicht gespeichert werden ('+(e&&e.code||'Fehler')+').');}},
getDraft(){try{return JSON.parse(localStorage.getItem(DRAFT())||'null');}catch{return null;}},
async refresh(){if(pending||blocked)return null;if(mode!=='device'&&remoteRev<=revision)return null;const r=await current();if(r.revision===revision)return null;revision=r.revision;meta=r.meta||null;return r.state;},
};

/* ---------- Reisetagebuch ---------- */
const Diary={
  async list(){await init();const s=await retry(()=>base.collection('diary').get());return s.docs.map(d=>({...d.data(),id:d.id}));},
  async save(entry,keepStamp=false){await init();const e={...entry,updated:keepStamp&&entry.updated?entry.updated:stamp()};await retry(()=>base.collection('diary').doc(e.id).set(e));changeStamps(st=>{delete st.tomb['e:'+e.id];}).catch(()=>{});markChange();return e;},
  async remove(id){await init();await retry(()=>base.collection('diary').doc(id).delete());await changeStamps((st,now)=>{st.tomb['e:'+id]=now;}).catch(()=>{});markChange();},
  async putPhoto(id,dataUrl){await init();if(dataUrl.length>240000)throw Error('Foto ist zu groß.');await retry(()=>base.collection('photos').doc(id).set({d:dataUrl}));},
  async getPhoto(id){await init();const s=await retry(()=>base.collection('photos').doc(id).get());return s.exists?s.data().d:null;},
  async dropPhoto(id){await init();try{await base.collection('photos').doc(id).delete();}catch{}},
  watch(cb){init().then(()=>{base.collection('diary').onSnapshot(s=>{if(!s.metadata.hasPendingWrites)cb(s.docs.map(d=>({...d.data(),id:d.id})));},()=>{});});},
};

/* ---------- Abgleich über eine Datei (z. B. geteilter iCloud-Drive-Ordner) ---------- */
const t=x=>x?Date.parse(x)||0:0;
function syncStatus(){try{return JSON.parse(localStorage.getItem(SYNC_STATUS())||'{}');}catch{return {};}}
function setSyncStatus(k){try{const s=syncStatus();s[k]=stamp();localStorage.setItem(SYNC_STATUS(),JSON.stringify(s));}catch{}root.dispatchEvent(new CustomEvent('travel-sync-status'));}
const Sync={
  status:syncStatus,
  markLoaded(){setSyncStatus('loaded');},
  fileName(){return 'reiseatelier-'+slug()+'.json';},
  /* Zu welcher Reise gehört die Datei? same = diese Reise (oder alte Datei ohne Kennung), known = andere vorhandene Reise, new = unbekannt. */
  async whose(file){await init();if(!file||file.type!=='reiseatelier-abgleich')throw Error('Das ist keine Abgleich-Datei des Reiseateliers.');
    if(!file.tripId||file.tripId===tripId)return {kind:'same'};const t=registry.list.find(x=>x.id===file.tripId);
    return t?{kind:'known',id:t.id,title:t.title||file.tripTitle||'Unbenannte Reise'}:{kind:'new',id:file.tripId,title:file.tripTitle||file.trip?.settings?.title||'Reise aus Abgleich-Datei',type:file.trip?.settings?.tripType||'rundreise'};},
  /* Änderungen auf diesem Gerät, die noch nicht in einer gespeicherten Abgleich-Datei stecken? */
  dirty(){const s=syncStatus();return !!s.changed&&(!s.saved||Date.parse(s.changed)>Date.parse(s.saved));},
  async exportFile(){await Store.flush();const cur=await current(),st=await getStamps(),entries=await Diary.list();const photos={};
    for(const e of entries)for(const p of e.photos||[]){if(!photos[p]){const d=await Diary.getPhoto(p);if(d)photos[p]=d;}}
    const info=registry.list.find(t=>t.id===tripId)||{};
    const text=JSON.stringify({type:'reiseatelier-abgleich',version:2,tripId,tripTitle:cur.state.settings.title||info.title||'',exportedAt:stamp(),trip:cur.state,stamps:st,diary:entries,photos});
    const ok=await Store.download(Sync.fileName(),text);if(ok)setSyncStatus('saved');return {ok,size:text.length,entries:entries.length,photos:Object.keys(photos).length};},
  /* Plant das Zusammenführen, ohne etwas zu schreiben. */
  async plan(file){await Store.flush();
    if(!file||file.type!=='reiseatelier-abgleich'||!file.trip||!Array.isArray(file.diary))throw Error('Das ist keine Abgleich-Datei des Reiseateliers.');
    const R=C().validateState(file.trip),RS={items:{...(file.stamps?.items||{})},tomb:{...(file.stamps?.tomb||{})}};
    const cur=await current(),L=cur.state,LS=await getStamps();
    const Lm=new Map(L.destinations.map(d=>[d.id,d]));
    /* Gleiche Station mit unterschiedlicher Kennung (z. B. Route auf beiden Geräten getrennt eingetragen) zusammenführen. */
    const nat=d=>[d.name,d.country,d.start].join('|').toLowerCase(),Lnat=new Map(L.destinations.filter(d=>!R.destinations.some(r=>r.id===d.id)).map(d=>[nat(d),d.id]));
    const Rm=new Map(R.destinations.map(d=>{if(!Lm.has(d.id)&&Lnat.has(nat(d))){const id=Lnat.get(nat(d));Lnat.delete(nat(d));const k='d:'+d.id;if(RS.items[k]){RS.items['d:'+id]=RS.items[k];delete RS.items[k];}return [id,{...d,id}];}return [d.id,d];}));
    const out=[],stamps={items:{},tomb:{}},n={tripNew:0,tripUpd:0,tripDel:0,diaryNew:0,diaryUpd:0,diaryDel:0};
    const keyT=(S,k)=>t(S.items[k]),tombT=(S,k)=>t(S.tomb[k]);
    const allIds=[...Lm.keys(),...[...Rm.keys()].filter(id=>!Lm.has(id))];
    for(const id of allIds){const k='d:'+id,l=Lm.get(id),r=Rm.get(id),ls=keyT(LS,k),rs=keyT(RS,k),lt=tombT(LS,k),rt=tombT(RS,k);
      if(l&&r){const take=rs>ls?r:l;if(take===r&&canonical(r)!==canonical(l))n.tripUpd++;out.push(take);stamps.items[k]=new Date(Math.max(ls,rs)||Date.now()).toISOString();}
      else if(r){if(lt&&lt>=rs){stamps.tomb[k]=LS.tomb[k];}else{out.push(r);n.tripNew++;stamps.items[k]=RS.items[k]||stamp();}}
      else if(l){if(rt&&rt>=ls){stamps.tomb[k]=RS.tomb[k];n.tripDel++;}else{out.push(l);stamps.items[k]=LS.items[k]||stamp();}}}
    for(const S of [LS,RS])for(const [k,v] of Object.entries(S.tomb))if(k.startsWith('d:')&&!stamps.items[k]&&(!stamps.tomb[k]||t(v)>t(stamps.tomb[k])))stamps.tomb[k]=v;
    const sl=keyT(LS,'s'),sr=keyT(RS,'s'),useR=sr>sl;stamps.items.s=new Date(Math.max(sl,sr)||Date.now()).toISOString();
    const Lc=splitSettings(L.settings).checks,Rc=splitSettings(R.settings).checks,checks={};
    for(const c of new Set([...Object.keys(Lc),...Object.keys(Rc)])){const k='x:'+c,l=Lc[c],r=Rc[c],ls=keyT(LS,k),rs=keyT(RS,k),lt=tombT(LS,k),rt=tombT(RS,k);
      if(l&&r){checks[c]=rs>ls?r:l;stamps.items[k]=new Date(Math.max(ls,rs)||Date.now()).toISOString();}
      else if(r){if(lt&&lt>=rs)stamps.tomb[k]=LS.tomb[k];else{checks[c]=r;stamps.items[k]=RS.items[k]||stamp();n.tripUpd++;}}
      else if(l){if(rt&&rt>=ls){stamps.tomb[k]=RS.tomb[k];n.tripUpd++;}else{checks[c]=l;stamps.items[k]=LS.items[k]||stamp();}}}
    for(const S of [LS,RS])for(const [k,v] of Object.entries(S.tomb))if(k.startsWith('x:')&&!stamps.items[k]&&(!stamps.tomb[k]||t(v)>t(stamps.tomb[k])))stamps.tomb[k]=v;
    const baseSettings=splitSettings(useR?R.settings:L.settings).s;
    const merged=C().validateState({version:1,settings:{...baseSettings,entry:{...(baseSettings.entry||{}),checks}},routeMode:useR?R.routeMode:L.routeMode,destinations:out});
    if(useR&&canonical({s:splitSettings(R.settings).s,m:R.routeMode})!==canonical({s:splitSettings(L.settings).s,m:L.routeMode}))n.tripUpd++;
    const local=await Diary.list(),Ld=new Map(local.map(e=>[e.id,e])),Rd=new Map(file.diary.filter(e=>e&&typeof e.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)).map(e=>[e.id,e]));
    const diaryPut=[],diaryDel=[];
    for(const [id,r] of Rd){const l=Ld.get(id),k='e:'+id,lt=tombT(LS,k);
      if(l){if(t(r.updated)>t(l.updated)&&canonical(r)!==canonical(l)){diaryPut.push(r);n.diaryUpd++;}}
      else if(!(lt&&lt>=t(r.updated))){diaryPut.push(r);n.diaryNew++;}}
    for(const [id,l] of Ld){const k='e:'+id,rt=tombT(RS,k);if(!Rd.has(id)&&rt&&rt>=t(l.updated)){diaryDel.push(l);n.diaryDel++;}}
    for(const S of [LS,RS])for(const [k,v] of Object.entries(S.tomb))if(k.startsWith('e:')&&(!stamps.tomb[k]||t(v)>t(stamps.tomb[k])))stamps.tomb[k]=v;
    for(const e of [...local.filter(e=>!diaryDel.includes(e)),...diaryPut])delete stamps.tomb['e:'+e.id];
    const tripChanged=canonical(merged)!==canonical(L);
    return {n,tripChanged,merged,stamps,diaryPut,diaryDel,photos:file.photos||{},exportedAt:file.exportedAt,anything:tripChanged||diaryPut.length>0||diaryDel.length>0};},
  async apply(p){let backup=null;
    if(p.tripChanged){const r=await Store._replace(p.merged,'replace','vor-abgleich');backup=r.backup;}
    await retry(()=>syncDoc().set(p.stamps));
    for(const e of p.diaryPut){const ids=[];for(const pid of (e.photos||[]).slice(0,12)){const d=p.photos[pid];if(typeof d==='string'&&d.startsWith('data:image/')&&d.length<=240000){await Diary.putPhoto(pid,d);ids.push(pid);}else if(await Diary.getPhoto(pid))ids.push(pid);}
      const clean={id:e.id,date:e.date,time:/^\d{2}:\d{2}$/.test(e.time||'')?e.time:'',title:String(e.title||'').slice(0,200),text:String(e.text||'').slice(0,20000),mood:String(e.mood||'').slice(0,20),weather:String(e.weather||'').slice(0,20),temp:Number.isFinite(e.temp)?e.temp:null,place:String(e.place||'').slice(0,200),destinationId:String(e.destinationId||''),photos:ids,created:e.created||stamp(),updated:e.updated||stamp()};
      await retry(()=>base.collection('diary').doc(clean.id).set(clean));}
    for(const e of p.diaryDel){await retry(()=>base.collection('diary').doc(e.id).delete());for(const pid of e.photos||[])Diary.dropPhoto(pid);}
    setSyncStatus('loaded');const cur=await current();revision=cur.revision;meta=cur.meta;return {state:cur.state,backup};},
};

Store.diary=Diary;Store.sync=Sync;Store.trips=Trips;
root.TravelStore=Store;
root.addEventListener('beforeunload',e=>{if(pending||blocked){e.preventDefault();e.returnValue='';}});
})(globalThis);
