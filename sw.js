/* Reiseatelier – Offline-Unterstützung (eigene Cache-Namen „rau-…“, damit andere Reiseatelier-Versionen auf derselben Domain unberührt bleiben): App-Dateien vorhalten, Kartenkacheln beim Ansehen zwischenspeichern. */
const VERSION='rau-app-u5';
const SHELL=['./','./index.html','./i18n.js','./style.css','./dark.css','./app.js','./core.js','./store.js','./planning.js','./information.js','./information-core.js','./countdown.js','./trips.js','./diary.js','./home.js','./sync.js','./emergency-numbers.js','./missions-de.js','./aa-live.js','./emergency.js','./extras.js','./entry-data.js','./entry.js','./importexport.js','./packing.js','./budget.js','./world.js','./cities.json','./vendor/leaflet.js','./vendor/leaflet.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const TILES='rau-tiles',MAX_TILES=1500;
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('rau-')&&k!==VERSION&&k!==TILES&&k!==SHARE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function trimTiles(){const c=await caches.open(TILES),ks=await c.keys();for(const k of ks.slice(0,Math.max(0,ks.length-MAX_TILES)))await c.delete(k);}
/* „Teilen an Reiseatelier“ (Android): geteilten Text bzw. Datei zwischenspeichern und die App öffnen. */
const SHARE='rau-share';
async function receiveShare(req){try{const fd=await req.formData();const file=fd.get('file');const payload={title:String(fd.get('title')||''),text:String(fd.get('text')||''),url:String(fd.get('url')||''),file:null,received:Date.now()};
    if(file&&typeof file.text==='function'&&file.size<5*1024*1024)payload.file={name:file.name||'geteilt.txt',type:file.type||'',text:await file.text()};
    const c=await caches.open(SHARE);await c.put(new URL('./__shared__',self.registration.scope).href,new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}}));}catch(e){}
  return Response.redirect(new URL('./index.html?shared=1#einstellungen',self.registration.scope).href,303);}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method==='POST'&&u.origin===location.origin&&u.pathname.endsWith('/share-target')){e.respondWith(receiveShare(e.request));return;}
  if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('tile.openstreetmap.org')){e.respondWith(caches.open(TILES).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok||r.type==='opaque'){c.put(e.request,r.clone());trimTiles();}return r;}));return;}
  if(u.origin!==location.origin)return;
  /* App-Dateien: erst Netz (damit Updates ankommen), offline aus dem Speicher */
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(VERSION).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
