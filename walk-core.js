'use strict';
/* Reiseatelier – Fußgänger-Navi, Rechenteil (ohne Oberfläche, auch in Node testbar).
   Routen kommen vom FOSSGIS-Routingserver (OSRM, ohne Schlüssel) oder von openrouteservice (eigener Schlüssel)
   und werden in ein gemeinsames Format gebracht. Dazu: Abbiegehinweise in Deutsch/Englisch, Position auf der Route,
   Reihenfolge optimieren, GPX-Export. */
(function(root){
const R=6371008.8,rad=Math.PI/180;
function dist(a,b){const dLat=(b[0]-a[0])*rad,dLng=(b[1]-a[1])*rad,s=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));}
function bearing(a,b){const y=Math.sin((b[1]-a[1])*rad)*Math.cos(b[0]*rad),x=Math.cos(a[0]*rad)*Math.sin(b[0]*rad)-Math.sin(a[0]*rad)*Math.cos(b[0]*rad)*Math.cos((b[1]-a[1])*rad);return (Math.atan2(y,x)/rad+360)%360;}
/* ---------- Texte ---------- */
const T={
  de:{dirs:['Norden','Nordosten','Osten','Südosten','Süden','Südwesten','Westen','Nordwesten'],
    mod:{left:'links','right':'rechts','slight left':'leicht links','slight right':'leicht rechts','sharp left':'scharf links','sharp right':'scharf rechts',straight:'geradeaus',uturn:'wenden'},
    onto:n=>n?' auf '+n:'',
    depart:(dir,n)=>`Richtung ${dir} gehen${n?' auf '+n:''}`,
    turn:(m,n)=>m==='geradeaus'?`Geradeaus weiter${n?' auf '+n:''}`:m==='wenden'?'Wenden':`${cap(m)} abbiegen${n?' auf '+n:''}`,
    cont:n=>`Weiter${n?' auf '+n:''}`,
    end:(m,n)=>`Am Ende des Weges ${m}${n?' auf '+n:''}`,
    fork:(m,n)=>`An der Gabelung ${m} halten${n?' auf '+n:''}`,
    keep:(m,n)=>`${cap(m)} halten${n?' auf '+n:''}`,
    round:(x,n)=>x?`Im Kreisverkehr die ${x}. Ausfahrt nehmen${n?' auf '+n:''}`:`In den Kreisverkehr${n?' – Ausfahrt '+n:''}`,
    exitRound:n=>`Kreisverkehr verlassen${n?' auf '+n:''}`,
    waypoint:n=>`Zwischenziel erreicht: ${n}`,
    arrive:n=>`Ziel erreicht: ${n}`,
    toStop:(d,n)=>`Noch ${d.replace('Metern','Meter').replace('Kilometern','Kilometer')} bis ${n}`,
    inDist:(d,t)=>`In ${d} ${t.charAt(0).toLowerCase()+t.slice(1)}`,now:t=>`Jetzt ${t.charAt(0).toLowerCase()+t.slice(1)}`,
    m:n=>n>=1000?(n/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' km':n+' m',mSpoken:n=>n>=1000?(n/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' Kilometern':n+' Metern',
    min:s=>{const m=Math.max(1,Math.round(s/60));return m>=60?Math.floor(m/60)+' Std. '+(m%60?m%60+' Min.':''):m+' Min.';}},
  en:{dirs:['north','north-east','east','south-east','south','south-west','west','north-west'],
    mod:{left:'left','right':'right','slight left':'slightly left','slight right':'slightly right','sharp left':'sharp left','sharp right':'sharp right',straight:'straight on',uturn:'make a U-turn'},
    onto:n=>n?' onto '+n:'',
    depart:(dir,n)=>`Head ${dir}${n?' on '+n:''}`,
    turn:(m,n)=>m==='straight on'?`Continue straight on${n?' onto '+n:''}`:m==='make a U-turn'?'Make a U-turn':`Turn ${m}${n?' onto '+n:''}`,
    cont:n=>`Continue${n?' on '+n:''}`,
    end:(m,n)=>`At the end of the path, turn ${m}${n?' onto '+n:''}`,
    fork:(m,n)=>`At the fork, keep ${m}${n?' onto '+n:''}`,
    keep:(m,n)=>`Keep ${m}${n?' onto '+n:''}`,
    round:(x,n)=>x?`At the roundabout, take the ${ord(x)} exit${n?' onto '+n:''}`:`Enter the roundabout${n?' – exit '+n:''}`,
    exitRound:n=>`Exit the roundabout${n?' onto '+n:''}`,
    waypoint:n=>`Stop reached: ${n}`,
    arrive:n=>`You have arrived: ${n}`,
    toStop:(d,n)=>`${cap(d)} to ${n}`,
    inDist:(d,t)=>`In ${d}, ${t.charAt(0).toLowerCase()+t.slice(1)}`,now:t=>`Now ${t.charAt(0).toLowerCase()+t.slice(1)}`,
    m:n=>n>=1000?(n/1000).toLocaleString('en-GB',{maximumFractionDigits:1})+' km':n+' m',mSpoken:n=>n>=1000?(n/1000).toLocaleString('en-GB',{maximumFractionDigits:1})+' kilometres':n+' metres',
    min:s=>{const m=Math.max(1,Math.round(s/60));return m>=60?Math.floor(m/60)+' h '+(m%60?m%60+' min':''):m+' min';}}};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const ord=n=>n+(n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th');
const lang=()=>root.RA_LANG==='en'?'en':'de';
const tx=l=>T[l||lang()];
function roundDist(m){if(m<20)return Math.max(5,Math.round(m/5)*5);if(m<200)return Math.round(m/10)*10;if(m<1000)return Math.round(m/50)*50;return Math.round(m/100)*100;}
function fmtDist(m,l){return tx(l).m(roundDist(Math.max(0,m)));}
function fmtDur(s,l){return tx(l).min(s).trim();}
function instruction(step,l){const t=tx(l),n=step.name||'',m=t.mod[step.mod]||t.mod.straight;
  switch(step.type){
    case 'depart':return t.depart(t.dirs[Math.round((step.bearing||0)/45)%8],n);
    case 'arrive':return t.arrive(step.stop||n);
    case 'waypoint':return t.waypoint(step.stop||n);
    case 'roundabout':return t.round(step.exit,n);
    case 'exit roundabout':return t.exitRound(n);
    case 'new name':return t.cont(n);
    case 'continue':return step.mod&&step.mod!=='straight'?t.turn(m,n):t.turn(t.mod.straight,n);
    case 'end of road':return t.end(m,n);
    case 'fork':return t.fork(m,n);
    case 'keep':return t.keep(m,n);
    default:return t.turn(m,n);}}
function spoken(step,meters,l){const t=tx(l),txt=instruction(step,l);if(step.type==='arrive'||step.type==='waypoint')return meters>25?t.toStop(t.mSpoken(roundDist(meters)),step.stop||step.name||''):txt;return meters>25?t.inDist(t.mSpoken(roundDist(meters)),txt):t.now(txt);}
/* ---------- Routing-Dienste ---------- */
const ENGINES={
  fossgis:{label:'FOSSGIS (OSRM)',max:25,
    request(points){const c=points.map(p=>p[1].toFixed(6)+','+p[0].toFixed(6)).join(';');return {url:`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${c}?overview=full&geometries=geojson&steps=true`,init:{}};}},
  ors:{label:'openrouteservice',max:50,
    request(points,opt){return {url:'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',init:{method:'POST',headers:{'Content-Type':'application/json','Authorization':opt.key||''},body:JSON.stringify({coordinates:points.map(p=>[p[1],p[0]]),instructions:true,language:(opt.lang||lang())==='en'?'en':'de',units:'m'})}};}}};
function nearestIndex(coords,loc,from){let best=from,bd=Infinity;for(let i=from;i<coords.length;i++){const d=dist(coords[i],loc);if(d<bd){bd=d;best=i;}if(bd<0.5)break;}return best;}
const ORS_TYPE={0:['turn','left'],1:['turn','right'],2:['turn','sharp left'],3:['turn','sharp right'],4:['turn','slight left'],5:['turn','slight right'],6:['continue','straight'],7:['roundabout',''],8:['exit roundabout',''],9:['turn','uturn'],10:['arrive',''],11:['depart',''],12:['keep','left'],13:['keep','right']};
/* names: Namen der Punkte in Reihenfolge (für „Zwischenziel erreicht: …“) */
function parseOSRM(j,names){if(!j||j.code!=='Ok'||!j.routes||!j.routes[0])throw Error(j&&j.message?j.message:'Keine Route gefunden.');
  const r=j.routes[0],coords=r.geometry.coordinates.map(c=>[c[1],c[0]]);const steps=[],legs=[];let ci=0;
  r.legs.forEach((leg,li)=>{for(const s of leg.steps||[]){const mv=s.maneuver||{},loc=[mv.location[1],mv.location[0]];
      let type=mv.type||'turn';if(type==='depart'&&li>0)continue;
      if(type==='arrive')type=li<r.legs.length-1?'waypoint':'arrive';
      if(['notification','use lane','on ramp','off ramp','merge'].includes(type))type=mv.modifier&&mv.modifier!=='straight'?'turn':'continue';
      if(type==='rotary'||type==='roundabout turn')type='roundabout';if(type==='exit rotary')type='exit roundabout';
      ci=nearestIndex(coords,loc,ci);steps.push({type,mod:mv.modifier||'',name:s.name||'',exit:mv.exit||0,dist:s.distance,dur:s.duration,i:ci,leg:li,bearing:mv.bearing_after||0,stop:type==='waypoint'||type==='arrive'?(names&&names[li+1])||'':''});}
    legs.push({distance:leg.distance,duration:leg.duration,end:ci});});
  return finish({engine:'fossgis',distance:r.distance,duration:r.duration,coords,steps,legs});}
function parseORS(j,names){const f=j&&j.features&&j.features[0];if(!f)throw Error(j&&j.error?(j.error.message||String(j.error)):'Keine Route gefunden.');
  const coords=f.geometry.coordinates.map(c=>[c[1],c[0]]),steps=[],legs=[],segs=f.properties.segments||[];
  segs.forEach((seg,li)=>{for(const s of seg.steps||[]){const [type0,mod]=ORS_TYPE[s.type]||['turn','straight'];let type=type0;if(type==='depart'&&li>0)continue;if(type==='arrive')type=li<segs.length-1?'waypoint':'arrive';
      const i=s.way_points?s.way_points[0]:0;steps.push({type,mod,name:s.name&&s.name!=='-'?s.name:'',exit:s.exit_number||0,dist:s.distance,dur:s.duration,i,leg:li,bearing:type==='depart'&&coords[i+1]?bearing(coords[i],coords[i+1]):0,stop:type==='waypoint'||type==='arrive'?(names&&names[li+1])||'':''});}
    legs.push({distance:seg.distance||0,duration:seg.duration||0,end:steps.length?steps[steps.length-1].i:0});});
  const sum=f.properties.summary||{};return finish({engine:'ors',distance:sum.distance||legs.reduce((a,b)=>a+b.distance,0),duration:sum.duration||legs.reduce((a,b)=>a+b.duration,0),coords,steps,legs});}
function finish(r){r.at=new Date().toISOString();prep(r);return r;}
/* Strecke entlang der Route vorberechnen */
function prep(r){if(r.cum&&r.cum.length===r.coords.length)return r;const cum=[0];for(let i=1;i<r.coords.length;i++)cum.push(cum[i-1]+dist(r.coords[i-1],r.coords[i]));r.cum=cum;r.length=cum[cum.length-1]||0;
  for(const s of r.steps)s.along=cum[Math.min(s.i,cum.length-1)]||0;for(const l of r.legs)l.along=cum[Math.min(l.end,cum.length-1)]||0;return r;}
function strip(r){const {cum,length,...rest}=r;rest.steps=r.steps.map(({along,...s})=>s);rest.legs=r.legs.map(({along,...l})=>l);return rest;}
/* ---------- Position auf der Route ---------- */
function project(p,a,b){const k=Math.cos(p[0]*rad)*R*rad,ky=R*rad;const ax=(a[1]-p[1])*k,ay=(a[0]-p[0])*ky,bx=(b[1]-p[1])*k,by=(b[0]-p[0])*ky;const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy;let t=L2?-(ax*dx+ay*dy)/L2:0;t=Math.max(0,Math.min(1,t));const x=ax+t*dx,y=ay+t*dy;return {t,d:Math.hypot(x,y)};}
function scan(r,p,from,to){let best=null;for(let i=from;i<to;i++){const q=project(p,r.coords[i],r.coords[i+1]);if(!best||q.d<best.d)best={seg:i,t:q.t,d:q.d};}return best;}
function locate(r,p,hint){prep(r);const n=r.coords.length;if(n<2)return null;let best=null;
  if(Number.isInteger(hint)){best=scan(r,p,Math.max(0,hint-30),Math.min(n-1,hint+400));if(best&&best.d>40){const g=scan(r,p,0,n-1);if(g.d<best.d-15)best=g;}}
  else best=scan(r,p,0,n-1);
  const a=r.coords[best.seg],b=r.coords[best.seg+1];best.along=r.cum[best.seg]+best.t*(r.cum[best.seg+1]-r.cum[best.seg]);best.pt=[a[0]+(b[0]-a[0])*best.t,a[1]+(b[1]-a[1])*best.t];best.remaining=Math.max(0,r.length-best.along);return best;}
function nextStep(r,along){for(const s of r.steps){if(s.type==='depart')continue;if(s.along>along+3)return s;}return r.steps[r.steps.length-1]||null;}
function pointAt(r,along){prep(r);const c=r.cum;let i=0;while(i<c.length-2&&c[i+1]<along)i++;const seg=c[i+1]-c[i]||1,t=Math.max(0,Math.min(1,(along-c[i])/seg));const a=r.coords[i],b=r.coords[i+1]||a;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
/* Gefahrene Strecke als Teilstück (für die graue „schon gegangen“-Linie) */
function slice(r,from,to){prep(r);const out=[pointAt(r,from)];for(let i=0;i<r.coords.length;i++)if(r.cum[i]>from&&r.cum[i]<to)out.push(r.coords[i]);out.push(pointAt(r,to));return out;}
/* ---------- Reihenfolge optimieren (erster Punkt bleibt Start) ---------- */
function optimize(stops,loop){if(stops.length<3)return stops.slice();const P=stops.map(s=>[s.lat,s.lng]),n=P.length,D=P.map(a=>P.map(b=>dist(a,b)));
  const order=[0],used=new Set([0]);while(order.length<n){const last=order[order.length-1];let bi=-1,bd=Infinity;for(let j=0;j<n;j++)if(!used.has(j)&&D[last][j]<bd){bd=D[last][j];bi=j;}order.push(bi);used.add(bi);}
  const len=o=>{let s=0;for(let i=0;i<o.length-1;i++)s+=D[o[i]][o[i+1]];if(loop)s+=D[o[o.length-1]][o[0]];return s;};
  let improved=true,guard=0;while(improved&&guard++<200){improved=false;for(let i=1;i<n-1;i++)for(let k=i+1;k<n;k++){const o=order.slice(0,i).concat(order.slice(i,k+1).reverse(),order.slice(k+1));if(len(o)<len(order)-0.01){order.splice(0,n,...o);improved=true;}}}
  return order.map(i=>stops[i]);}
function straightLength(stops,loop){let s=0;for(let i=1;i<stops.length;i++)s+=dist([stops[i-1].lat,stops[i-1].lng],[stops[i].lat,stops[i].lng]);if(loop&&stops.length>2)s+=dist([stops.at(-1).lat,stops.at(-1).lng],[stops[0].lat,stops[0].lng]);return s;}
/* ---------- GPX ---------- */
function gpx(walk,route){const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const w=walk.stops.map(s=>`  <wpt lat="${s.lat}" lon="${s.lng}"><name>${e(s.name)}</name></wpt>`).join('\n');
  const trk=route?`  <trk><name>${e(walk.title)}</name><trkseg>\n${route.coords.map(c=>`    <trkpt lat="${c[0].toFixed(6)}" lon="${c[1].toFixed(6)}"/>`).join('\n')}\n  </trkseg></trk>`:'';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Reiseatelier" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${e(walk.title)}</name></metadata>\n${w}\n${trk}\n</gpx>\n`;}
/* Schlüssel für den Routenspeicher: gleiche Punkte + gleiche Einstellungen = gleiche Route */
function routeKey(points,engine,loop){return engine+'|'+(loop?'o':'-')+'|'+points.map(p=>p[0].toFixed(5)+','+p[1].toFixed(5)).join(';');}
/* Links für andere Navi-Apps */
function links(lat,lng,name){const q=lat.toFixed(6)+','+lng.toFixed(6),n=encodeURIComponent(name||'');return {
  google:`https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=walking`,
  apple:`https://maps.apple.com/?daddr=${q}&dirflg=w${n?'&q='+n:''}`,
  geo:`geo:${q}?q=${q}${n?'('+n+')':''}`};}
const api={dist,bearing,T,instruction,spoken,fmtDist,fmtDur,roundDist,ENGINES,parseOSRM,parseORS,prep,strip,locate,nextStep,pointAt,slice,optimize,straightLength,gpx,routeKey,links};
root.TravelWalkCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
