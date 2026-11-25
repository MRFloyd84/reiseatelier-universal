'use strict';
/* Reiseatelier – Offline-Kartenpakete und Routenspeicher.
   Kartenpakete sind PMTiles-Dateien (Vektorkarten aus OpenStreetMap, aufbereitet von Protomaps) für einen Stadtbereich.
   Sie werden von GitHub Pages (Ordner maps/, erzeugt von der GitHub Action „Seite und Kartenpakete“) oder aus einer
   eigenen Datei geladen und liegen dauerhaft auf diesem Gerät (IndexedDB). Die Kacheln von openstreetmap.org werden
   dafür nicht verwendet – deren Nutzungsbedingungen verbieten das Vorab-Herunterladen.
   Berechnete Fußwege werden ebenfalls hier gespeichert, damit sie ohne Netz verfügbar bleiben. */
(function(root){
const DB='reiseatelier-universal-maps',CAT_KEY='rau.maps.catalog';
let dbp=null;
function db(){if(!dbp)dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('packs'))d.createObjectStore('packs',{keyPath:'id'});if(!d.objectStoreNames.contains('routes'))d.createObjectStore('routes');};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});return dbp;}
async function tx(store,mode,fn){const d=await db();return new Promise((res,rej)=>{const t=d.transaction(store,mode),s=t.objectStore(store);let out;const r=fn(s);if(r)r.onsuccess=()=>{out=r.result;};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error||Error('Gerätespeicher-Fehler'));t.onabort=()=>rej(t.error||Error('Speicher voll oder gesperrt'));});}
const EN=()=>root.RA_LANG==='en';
const baseDir=()=>location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');
/* ---------- Pakete auf dem Gerät ---------- */
let metaCache=null;
async function list(){if(metaCache)return metaCache;const all=await tx('packs','readonly',s=>s.getAll());metaCache=(all||[]).map(({blob,...m})=>m).sort((a,b)=>a.name.localeCompare(b.name));return metaCache;}
async function getPack(id){return tx('packs','readonly',s=>s.get(id));}
async function putPack(p){metaCache=null;await tx('packs','readwrite',s=>s.put(p));try{await navigator.storage?.persist?.();}catch{}}
async function remove(id){metaCache=null;opened.delete(id);await tx('packs','readwrite',s=>s.delete(id));}
const contains=(b,lat,lng)=>lng>=b[0]&&lng<=b[2]&&lat>=b[1]&&lat<=b[3];
const area=b=>(b[2]-b[0])*(b[3]-b[1]);
async function forPoint(lat,lng){const l=(await list()).filter(p=>contains(p.bbox,lat,lng));l.sort((a,b)=>area(a.bbox)-area(b.bbox));return l[0]||null;}
/* ---------- Katalog (maps/catalog.json auf GitHub Pages) ---------- */
async function catalog(force){let cached=null;try{cached=JSON.parse(localStorage.getItem(CAT_KEY)||'null');}catch{}
  if(!force&&cached&&Date.now()-cached.fetched<6*3600e3)return cached;
  try{const r=await fetch('./maps/catalog.json',{cache:'no-cache'});if(r.status===404)return {fetched:Date.now(),packs:[],missing:true};if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();const out={fetched:Date.now(),build:j.build||'',generated:j.generated||'',packs:Array.isArray(j.packs)?j.packs.filter(p=>p&&p.id&&p.file&&Array.isArray(p.bbox)):[]};try{localStorage.setItem(CAT_KEY,JSON.stringify(out));}catch{}return out;}
  catch(e){if(cached)return {...cached,offline:true};return {fetched:0,packs:[],offline:true,error:e.message};}}
/* Herunterladen mit Fortschritt; onProgress(geladen, gesamt) */
async function download(entry,onProgress,signal){const r=await fetch('./maps/'+encodeURIComponent(entry.file),{cache:'no-cache',signal});if(!r.ok)throw Error((EN()?'Download failed (HTTP ':'Download fehlgeschlagen (HTTP ')+r.status+').');
  const total=Number(r.headers.get('content-length'))||entry.size||0;let blob;
  if(r.body&&r.body.getReader){const rd=r.body.getReader(),parts=[];let got=0;for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;onProgress&&onProgress(got,total);}blob=new Blob(parts,{type:'application/octet-stream'});}
  else{blob=await r.blob();onProgress&&onProgress(blob.size,blob.size);}
  const head=await header(blob);
  const pack={id:entry.id,name:entry.name||entry.id,name_en:entry.name_en||'',country:entry.country||'',bbox:head.bbox||entry.bbox,size:blob.size,date:entry.date||'',build:entry.build||'',maxzoom:head.maxZoom,source:'catalog',saved:new Date().toISOString(),blob};
  await putPack(pack);prefetchAssets();return pack;}
/* Eigene .pmtiles-Datei übernehmen */
async function importFile(file){const head=await header(file);if(!head.bbox)throw Error(EN()?'This file is not a map package (.pmtiles).':'Diese Datei ist kein Kartenpaket (.pmtiles).');
  if(head.tileType!==1)throw Error(EN()?'Only vector map packages (Protomaps basemap) are supported.':'Unterstützt werden nur Vektor-Kartenpakete (Protomaps-Basiskarte).');
  const name=(file.name||'Karte').replace(/\.pmtiles$/i,'');const id='datei-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)+'-'+Math.round(head.bbox[0]*100);
  const pack={id,name,name_en:'',country:'',bbox:head.bbox,size:file.size,date:'',build:'',maxzoom:head.maxZoom,source:'file',saved:new Date().toISOString(),blob:file.slice(0,file.size,'application/octet-stream')};
  await putPack(pack);prefetchAssets();return pack;}
async function header(blob){if(!root.pmtiles)await loadLibs();const p=new root.pmtiles.PMTiles(new root.pmtiles.FileSource(new File([blob],'x.pmtiles')));const h=await p.getHeader();
  const ok=Number.isFinite(h.minLon)&&h.maxLon>h.minLon;return {bbox:ok?[h.minLon,h.minLat,h.maxLon,h.maxLat]:null,maxZoom:h.maxZoom,tileType:h.tileType};}
/* Schriften und Symbole einmal laden, damit Straßennamen auch offline erscheinen (der Service Worker speichert sie). */
async function prefetchAssets(){const fonts=['Noto Sans Regular','Noto Sans Medium','Noto Sans Italic'],ranges=['0-255','256-511','512-767','768-1023','1024-1279','7680-7935','8192-8447','8448-8703','65024-65279'];
  const urls=[];for(const f of fonts)for(const r of ranges)urls.push('./vendor/fonts/'+encodeURIComponent(f)+'/'+r+'.pbf');for(const t of ['light','dark'])for(const x of ['.json','.png','@2x.json','@2x.png'])urls.push('./vendor/sprites/v4/'+t+x);
  for(const u of urls){try{await fetch(u);}catch{}}}
async function usage(){try{const e=await navigator.storage.estimate();const persisted=await navigator.storage.persisted?.();return {used:e.usage||0,quota:e.quota||0,persisted:!!persisted};}catch{return null;}}
/* ---------- Bibliotheken bei Bedarf laden ---------- */
let libsP=null;
function script(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(Error('Konnte '+src+' nicht laden.'));document.head.append(s);});}
function loadLibs(){if(!libsP)libsP=(async()=>{if(!document.querySelector('link[data-maplibre]')){const l=document.createElement('link');l.rel='stylesheet';l.href='./vendor/maplibre-gl.css';l.dataset.maplibre='1';document.head.append(l);}
  if(!root.maplibregl)await script('./vendor/maplibre-gl.js');if(!root.pmtiles)await script('./vendor/pmtiles.js');if(!root.basemaps)await script('./vendor/basemaps.js');
  if(!root.__rauPmProtocol){root.__rauPmProtocol=new root.pmtiles.Protocol();root.maplibregl.addProtocol('pmtiles',root.__rauPmProtocol.tile);}})().catch(e=>{libsP=null;throw e;});return libsP;}
const opened=new Map();
async function sourceUrl(id){if(opened.has(id))return opened.get(id);const p=await getPack(id);if(!p)return null;const name='rau-'+id+'.pmtiles';const inst=new root.pmtiles.PMTiles(new root.pmtiles.FileSource(new File([p.blob],name)));root.__rauPmProtocol.add(inst);const url='pmtiles://'+name;opened.set(id,url);return url;}
const ATTR_OSM='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
/* Kartenstil: mit Paket → Vektorkarte (offline), sonst die normale OpenStreetMap-Karte (nur online bzw. schon angesehene Kacheln). */
async function style({pack,dark}){await loadLibs();const b=baseDir();const st={version:8,glyphs:b+'vendor/fonts/{fontstack}/{range}.pbf',sprite:b+'vendor/sprites/v4/'+(dark?'dark':'light'),sources:{},layers:[]};
  const url=pack?await sourceUrl(pack.id):null;
  if(url){st.sources.protomaps={type:'vector',url,attribution:'<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> '+ATTR_OSM};
    st.layers=root.basemaps.layers('protomaps',root.basemaps.namedFlavor(dark?'dark':'light'),{lang:EN()?'en':'de'});}
  else{st.sources.osm={type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:ATTR_OSM};
    st.layers=[{id:'background',type:'background',paint:{'background-color':dark?'#1b2426':'#e8e4da'}},{id:'osm',type:'raster',source:'osm',paint:dark?{'raster-brightness-max':0.72,'raster-saturation':-0.35,'raster-contrast':0.05}:{}}];}
  return st;}
/* ---------- Routenspeicher ---------- */
async function getRoute(key){try{return await tx('routes','readonly',s=>s.get(key));}catch{return null;}}
async function putRoute(key,route){try{await tx('routes','readwrite',s=>s.put({...route,saved:Date.now()},key));pruneRoutes();}catch{}}
let pruning=false;async function pruneRoutes(){if(pruning)return;pruning=true;try{const keys=await tx('routes','readonly',s=>s.getAllKeys());if(keys.length>300){const all=await tx('routes','readonly',s=>s.getAll());const pairs=keys.map((k,i)=>[k,all[i].saved||0]).sort((a,b)=>a[1]-b[1]);for(const [k] of pairs.slice(0,keys.length-300))await tx('routes','readwrite',s=>s.delete(k));}}finally{pruning=false;}}
const mb=n=>n<1048576?Math.max(1,Math.round(n/1024))+' KB':(n/1048576).toLocaleString(EN()?'en-GB':'de-DE',{maximumFractionDigits:n<10485760?1:0})+' MB';
root.TravelMaps={list,getPack,remove,forPoint,contains,catalog,download,importFile,usage,loadLibs,style,getRoute,putRoute,prefetchAssets,mb};
})(window);
