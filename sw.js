/* Reiseatelier – Offline-Unterstützung (eigene Cache-Namen „rau-…“, damit andere Reiseatelier-Versionen auf derselben Domain unberührt bleiben): App-Dateien vorhalten, Kartenkacheln beim Ansehen zwischenspeichern. */
const VERSION='rau-app-u2';
const SHELL=['./','./index.html','./i18n.js','./style.css','./app.js','./core.js','./store.js','./planning.js','./information.js','./information-core.js','./countdown.js','./trips.js','./diary.js','./home.js','./sync.js','./emergency-numbers.js','./missions-de.js','./aa-live.js','./emergency.js','./extras.js','./entry-data.js','./entry.js','./importexport.js','./world.js','./cities.json','./vendor/leaflet.js','./vendor/leaflet.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const TILES='rau-tiles',MAX_TILES=1500;
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('rau-')&&k!==VERSION&&k!==TILES).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function trimTiles(){const c=await caches.open(TILES),ks=await c.keys();for(const k of ks.slice(0,Math.max(0,ks.length-MAX_TILES)))await c.delete(k);}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname.endsWith('tile.openstreetmap.org')){e.respondWith(caches.open(TILES).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok||r.type==='opaque'){c.put(e.request,r.clone());trimTiles();}return r;}));return;}
  if(u.origin!==location.origin)return;
  /* App-Dateien: erst Netz (damit Updates ankommen), offline aus dem Speicher */
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(VERSION).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
