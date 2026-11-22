'use strict';
/* Reisestatistik (Startseite) und Postkarten aus dem Tagebuch – beide als teilbares Bild. */
(function(){
const q=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let names=null;try{names=new Intl.DisplayNames(['de'],{type:'region'});}catch{}
const cn=cc=>{try{return names?.of(cc)||cc;}catch{return cc;}};
const flag=cc=>/^[A-Z]{2}$/.test(cc)?String.fromCodePoint(...[...cc].map(c=>127397+c.charCodeAt(0))):'';
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const fmtN=n=>Math.round(n).toLocaleString('de-DE');
function trip(){try{return state;}catch{return {destinations:[],settings:{}};}}
const sorted=()=>[...(trip().destinations||[])].sort((a,b)=>(a.start+(a.arrival||'')).localeCompare(b.start+(b.arrival||'')));

// ---------- Statistik ----------
const CONT={Europa:'DE AT CH NL BE LU FR GB IE ES PT IT GR MT HR SI NO SE DK FI IS PL CZ SK HU EE LV LT MC GI FO',
  Nordamerika:'CA US MX BZ GT HN SV NI CR PA CU JM HT DO BS BB AG KN LC VC GD TT AW CW BQ SX MF BL VG VI PR KY TC BM GP MQ DM',
  Südamerika:'BR AR UY CL PE EC CO VE GY SR GF BO PY FK',Afrika:'ZA NA MZ MG MU RE SC KE TZ EG MA TN CV SN GH NG CI AO YT SH',
  Asien:'ID SG MY TH VN KH PH CN JP KR TW HK MO IN LK MV OM AE QA BH SA JO IL TR BN MM BD',Ozeanien:'AU NZ PF CK NC FJ VU WS TO PG SB KI NU WF PW FM MH GU MP'};
const contOf={};for(const [k,v] of Object.entries(CONT))for(const c of v.split(' '))contOf[c]=k;
function nm(a,b){const R=3440.065,r=x=>x*Math.PI/180,dLat=r(b.lat-a.lat),dLng=r(b.lng-a.lng);const x=Math.sin(dLat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function stats(upto){const all=sorted();if(!all.length)return null;const ds=upto?all.filter(d=>d.start<=upto):all;if(!ds.length)return {empty:true,first:all[0]};
  const geo=ds.filter(d=>d.lat!==null&&d.lng!==null);let miles=0,dateline=0,equator=0;
  for(let i=1;i<geo.length;i++){const a=geo[i-1],b=geo[i];miles+=nm(a,b);if(Math.abs(b.lng-a.lng)>180)dateline++;if(Math.sign(a.lat)!==Math.sign(b.lat)&&a.lat&&b.lat)equator++;}
  const ports=ds.filter(d=>d.kind!=='reisetag');
  const start=all[0].start,endAll=all.map(d=>d.end||d.start).sort().at(-1);const end=upto&&upto<endAll?upto:endAll;
  const covered=new Set();for(const d of ports){let t=Date.parse(d.start);const e=Date.parse(d.end||d.start);while(t<=e){covered.add(new Date(t).toISOString().slice(0,10));t+=86400000;}}
  let days=0,sea=0;for(let t=Date.parse(start);t<=Date.parse(end);t+=86400000){days++;if(!covered.has(new Date(t).toISOString().slice(0,10)))sea++;}
  const countries=[...new Set(ports.map(d=>d.country))];const conts=[...new Set(countries.map(c=>contOf[c]).filter(Boolean))];
  const north=geo.reduce((m,d)=>!m||d.lat>m.lat?d:m,null),south=geo.reduce((m,d)=>!m||d.lat<m.lat?d:m,null);
  return {miles,km:miles*1.852,ports:ports.length,countries,conts,days,sea,dateline,equator,north,south,earth:miles*1.852/40075};}
let diaryInfo=null;
async function loadDiaryInfo(){try{const l=await TravelStore.diary.list();diaryInfo={n:l.length,p:l.reduce((a,e)=>a+(e.photos||[]).length,0)};}catch{diaryInfo=null;}}
let mode=null;
function statsHtml(){const all=sorted();if(!all.length)return '';const today=iso(new Date()),first=all[0].start,last=all.map(d=>d.end||d.start).sort().at(-1);
  const running=today>=first&&today<=last,over=today>last;if(mode===null)mode=running?'bisher':'gesamt';
  const s=stats(mode==='bisher'?today:null),place=d=>d?h(d.city||d.name):'—';
  const head=`<div class="home-panel-head"><h3>Unsere Reise in Zahlen</h3>${running?`<div class="seg st-seg" role="group" aria-label="Zeitraum"><button type="button" data-st-mode="bisher" aria-pressed="${mode==='bisher'}">Bisher</button><button type="button" data-st-mode="gesamt" aria-pressed="${mode==='gesamt'}">Gesamt</button></div>`:`<span class="small">${over?'Die ganze Reise':'Was vor euch liegt'}</span>`}</div>`;
  if(!s||s.empty)return `<section class="panel home-stats">${head}<p class="muted">Die Reise beginnt am ${h(new Date(first+'T12:00').toLocaleDateString('de-DE',{day:'2-digit',month:'long',year:'numeric'}))}.</p></section>`;
  const cr=TravelCore.cruise,around=`${s.earth.toLocaleString('de-DE',{maximumFractionDigits:1})}× um die Erde`;
  const tiles=[cr?['⚓',fmtN(s.miles),'Seemeilen',`ca. ${fmtN(s.km)} km · ${around}`]:['➶',fmtN(s.km),'Kilometer',`Luftlinie zwischen den Stationen · ${around}`],
    ['⚑',s.ports,cr?'Häfen & Stationen':'Stationen',''],['◎',s.countries.length,'Länder',s.countries.map(flag).join(' ')],['◍',s.conts.length,'Kontinente',s.conts.join(' · ')],
    ['▦',s.days,'Reisetage',''],...(cr?[['≈',s.sea,'Seetage','']]:[]),['⊖',s.equator+'×','Äquator überquert',''],['⇆',s.dateline+'×','Datumsgrenze überquert',''],
    ['↑',place(s.north),'Nördlichster Ort',s.north?Math.abs(s.north.lat).toFixed(1)+'° '+(s.north.lat>=0?'N':'S'):''],['↓',place(s.south),'Südlichster Ort',s.south?Math.abs(s.south.lat).toFixed(1)+'° '+(s.south.lat>=0?'N':'S'):'']];
  if(diaryInfo)tiles.push(['✎',diaryInfo.n,'Tagebucheinträge',`${diaryInfo.p} ${diaryInfo.p===1?'Foto':'Fotos'}`]);
  return `<section class="panel home-stats">${head}<div class="st-grid">${tiles.map(([i,v,l,sub])=>`<div class="st-tile"><span class="st-icon" aria-hidden="true">${i}</span><b>${v}</b><span>${l}</span>${sub?`<small>${sub}</small>`:''}</div>`).join('')}</div><div class="button-row st-foot"><button type="button" class="secondary" data-st-share>⇪ Als Bild teilen</button><span class="small">${cr?'Seemeilen als direkte Strecke zwischen den Häfen – das Schiff fährt etwas mehr.':'Entfernungen als Luftlinie zwischen den Stationen – die tatsächliche Strecke ist länger.'}</span></div></section>`;}

// ---------- Bild-Helfer ----------
function wrap(ctx,text,x,y,maxW,lh,maxLines){const words=String(text).split(/\s+/);let line='',n=0;for(let i=0;i<words.length;i++){const t=line?line+' '+words[i]:words[i];if(ctx.measureText(t).width>maxW&&line){if(n===maxLines-1){while(line&&ctx.measureText(line+' …').width>maxW)line=line.slice(0,-1);ctx.fillText(line+' …',x,y+n*lh);return n+1;}ctx.fillText(line,x,y+n*lh);n++;line=words[i];}else line=t;}if(line){ctx.fillText(line,x,y+n*lh);n++;}return n;}
const SANS='-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif',SERIF='Georgia,"Times New Roman",serif';
function img(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(Error('Foto nicht lesbar'));i.src=src;});}
function cover(ctx,im,x,y,w,h){const s=Math.max(w/im.naturalWidth,h/im.naturalHeight),sw=w/s,sh=h/s;ctx.drawImage(im,(im.naturalWidth-sw)/2,(im.naturalHeight-sh)/2,sw,sh,x,y,w,h);}
function waves(ctx,y,w,col){ctx.strokeStyle=col;ctx.lineWidth=3;for(let k=0;k<3;k++){ctx.beginPath();for(let x=0;x<=w;x+=10)ctx.lineTo(x,y+k*16+Math.sin(x/38+k)*6);ctx.stroke();}}
function tripTitle(){return trip().settings?.title||'Unsere Reise';}

async function statsImage(){const s=stats(mode==='bisher'?iso(new Date()):null);const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,1350);g.addColorStop(0,'#123e50');g.addColorStop(1,'#178884');x.fillStyle=g;x.fillRect(0,0,1080,1350);
  waves(x,1272,1080,'rgba(255,255,255,.14)');
  x.fillStyle='rgba(255,255,255,.7)';x.font=`600 30px ${SANS}`;x.fillText(mode==='bisher'?'BISHER · STAND '+new Date().toLocaleDateString('de-DE'):'DIE GANZE REISE',80,120);
  x.fillStyle='#fff';x.font=`700 64px ${SERIF}`;wrap(x,tripTitle(),80,200,920,72,2);
  const cr=TravelCore.cruise;x.font=`800 150px ${SANS}`;x.fillText(fmtN(cr?s.miles:s.km),80,430);x.font=`500 40px ${SANS}`;x.fillStyle='rgba(255,255,255,.85)';x.fillText(cr?`Seemeilen · ca. ${fmtN(s.km)} km`:'Kilometer Luftlinie',84,490);
  const t=[[s.ports,cr?'Häfen':'Stationen'],[s.countries.length,'Länder'],[s.conts.length,'Kontinente'],[s.days,'Reisetage'],cr?[s.sea,'Seetage']:[s.north?Math.abs(s.north.lat).toFixed(0)+'° '+(s.north.lat>=0?'N':'S'):'—','Nördlichster Punkt'],[s.equator+'× / '+s.dateline+'×','Äquator / Datumsgrenze']];
  t.forEach(([v,l],i)=>{const cx=80+(i%2)*470,cy=600+Math.floor(i/2)*170;x.fillStyle='rgba(255,255,255,.1)';x.beginPath();if(x.roundRect)x.roundRect(cx,cy,440,140,22);else x.rect(cx,cy,440,140);x.fill();x.fillStyle='#fff';x.font=`800 62px ${SANS}`;x.fillText(String(v),cx+30,cy+78);x.font=`500 28px ${SANS}`;x.fillStyle='rgba(255,255,255,.8)';x.fillText(l,cx+30,cy+118);});
  x.font=`38px ${SANS}`;x.fillStyle='#fff';wrap(x,s.countries.map(flag).join(' '),80,1150,920,48,3);
  x.fillStyle='rgba(255,255,255,.6)';x.font=`500 24px ${SANS}`;x.fillText('Reiseatelier',80,1310);
  return c;}

async function postcardImage(e,photoId,text){const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
  const d=(trip().destinations||[]).find(d=>d.id===e.destinationId);const place=d?(d.city||d.name):(e.place||'');const cc=d?.country||'';
  x.fillStyle='#fbf8f2';x.fillRect(0,0,1080,1350);
  const PH=830;let pic=null;if(photoId){try{const src=await TravelStore.diary.getPhoto(photoId);if(src)pic=await img(src);}catch{}}
  if(pic)cover(x,pic,0,0,1080,PH);else{const g=x.createLinearGradient(0,0,1080,PH);g.addColorStop(0,'#123e50');g.addColorStop(1,'#35a8a0');x.fillStyle=g;x.fillRect(0,0,1080,PH);waves(x,PH-140,1080,'rgba(255,255,255,.25)');x.fillStyle='rgba(255,255,255,.9)';x.font=`160px ${SANS}`;x.textAlign='center';x.fillText(flag(cc)||'✧',540,PH/2+40);x.textAlign='left';}
  // Briefmarke
  if(cc){x.save();x.translate(900,60);x.rotate(.06);x.fillStyle='#fff';x.fillRect(0,0,130,160);x.strokeStyle='#c9b48a';x.setLineDash([6,6]);x.lineWidth=3;x.strokeRect(8,8,114,144);x.setLineDash([]);x.font=`70px ${SANS}`;x.textAlign='center';x.fillText(flag(cc),65,95);x.fillStyle='#7a6a48';x.font=`600 18px ${SANS}`;x.fillText(cc,65,135);x.restore();x.textAlign='left';}
  x.fillStyle='#123e50';x.font=`italic 700 70px ${SERIF}`;wrap(x,'Grüße aus '+(place||'unterwegs'),70,PH+105,940,78,2);
  const dateLine=new Date(e.date+'T12:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+(cc?' · '+cn(cc):'');
  x.fillStyle='#4f7b84';x.font=`500 30px ${SANS}`;const titleLines=x.measureText('Grüße aus '+place).width>940?2:1;const y0=PH+105+(titleLines-1)*78;x.fillText(dateLine,72,y0+52);
  x.fillStyle='#2a3d44';x.font=`400 34px ${SERIF}`;wrap(x,text,72,y0+118,936,46,Math.max(2,Math.floor((1350-60-(y0+118))/46)));
  x.fillStyle='#9aaeb3';x.font=`500 22px ${SANS}`;x.fillText(tripTitle(),72,1325);
  return c;}

// ---------- Vorschau-Dialog mit Teilen ----------
let current=null;
function dlg(){let d=q('#share-dialog');if(!d){d=document.createElement('dialog');d.id='share-dialog';d.className='share-dialog';document.body.append(d);}return d;}
function toBlob(c){return new Promise(r=>c.toBlob(r,'image/jpeg',.9));}
async function preview(canvas,name,extra=''){const blob=await toBlob(canvas);current={blob,name};const d=dlg();const url=URL.createObjectURL(blob);
  d.innerHTML=`<div class="modal-head"><h2>Vorschau</h2><button type="button" class="icon-btn" data-sh-close aria-label="Schließen">×</button></div>${extra}<img class="share-img" src="${url}" alt="Vorschau"><div class="modal-foot"><button type="button" class="secondary" data-sh-close>Schließen</button><button type="button" class="primary" data-sh-go>⇪ Teilen</button></div>`;
  if(!d.open)d.showModal();}
async function share(){if(!current)return;const file=new File([current.blob],current.name,{type:'image/jpeg'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return;}}catch(e){if(e?.name==='AbortError')return;}
  const u=URL.createObjectURL(current.blob),a=document.createElement('a');a.href=u;a.download=current.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);notify('Bild gespeichert.');}

// Postkarte: Eintrag laden, Foto wählen, Text kürzen
let pc=null;
async function openPostcard(id){let e=null;try{e=(await TravelStore.diary.list()).find(x=>x.id===id);}catch{}if(!e){notify('Eintrag nicht gefunden.');return;}
  pc={e,photo:(e.photos||[])[0]||null,text:(e.text||e.title||'').trim()};await drawPostcard();}
async function drawPostcard(){const {e}=pc;const photos=e.photos||[];
  const thumbs=photos.length>1?`<div class="pc-thumbs" role="group" aria-label="Foto wählen">${photos.map((p,i)=>`<button type="button" data-pc-photo="${h(p)}" aria-pressed="${p===pc.photo}"><img data-pc-src="${h(p)}" alt="Foto ${i+1}"></button>`).join('')}</div>`:'';
  const extra=`${thumbs}<label class="pc-text">Text auf der Karte<textarea id="pc-text" rows="3" maxlength="400">${h(pc.text)}</textarea></label><button type="button" class="secondary small-btn" data-pc-redraw>Vorschau aktualisieren</button>`;
  await preview(await postcardImage(e,pc.photo,pc.text),`postkarte-${e.date}.jpg`,extra);
  for(const im of document.querySelectorAll('[data-pc-src]'))TravelStore.diary.getPhoto(im.dataset.pcSrc).then(s=>{if(s)im.src=s;}).catch(()=>{});}

document.addEventListener('click',async ev=>{const t=ev.target;
  const m=t.closest?.('[data-st-mode]');if(m){mode=m.dataset.stMode;window.TravelHome?.onTrip();return;}
  if(t.closest?.('[data-st-share]')){try{await preview(await statsImage(),'reise-in-zahlen.jpg');}catch(e){notify('Bild konnte nicht erstellt werden: '+e.message);}return;}
  const p=t.closest?.('[data-postcard]');if(p){openPostcard(p.dataset.postcard);return;}
  const ph=t.closest?.('[data-pc-photo]');if(ph&&pc){pc.text=q('#pc-text')?.value||pc.text;pc.photo=ph.dataset.pcPhoto;await drawPostcard();return;}
  if(t.closest?.('[data-pc-redraw]')&&pc){pc.text=q('#pc-text').value;await drawPostcard();return;}
  if(t.closest?.('[data-sh-go]')){share();return;}
  if(t.closest?.('[data-sh-close]')){q('#share-dialog')?.close();pc=null;}});

window.TravelExtras={statsHtml,stats,refresh:async()=>{await loadDiaryInfo();window.TravelHome?.onTrip();}};
})();
