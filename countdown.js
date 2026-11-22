'use strict';
/* Countdown bis zum Reisebeginn bzw. Reisetag während der Reise (Kopfbereich „Meine Route“). */
(function(root){
/* ---------- Countdown ---------- */
const DAY=86400000;
function at(date,time){return new Date(date+'T'+(time||'00:00')+':00');}
function countdown(state){
  const ds=(state&&state.destinations||[]).filter(d=>d.start);if(!ds.length)return null;
  const first=ds.reduce((a,b)=>at(b.start,b.departure||b.arrival)<at(a.start,a.departure||a.arrival)?b:a);
  const last=ds.reduce((a,b)=>at(b.end||b.start,b.departure||b.arrival)>at(a.end||a.start,a.departure||a.arrival)?b:a);
  const begin=at(first.start,first.departure||first.arrival),end=at(last.end||last.start,last.arrival||last.departure||'23:59'),now=new Date();
  const totalDays=Math.round((at(last.end||last.start)-at(first.start))/DAY)+1;
  if(now<begin){const ms=begin-now,d=Math.floor(ms/DAY),h=Math.floor(ms%DAY/3600000),m=Math.floor(ms%3600000/60000);
    return {phase:'before',d,h,m,label:'bis zum Reisebeginn in '+(first.city||first.name),when:begin};}
  if(now<=end){const day=Math.floor((new Date(now.toDateString())-at(first.start))/DAY)+1;
    const here=ds.find(d=>{const s=at(d.start),e=at(d.end||d.start);return now>=s&&now<new Date(+e+DAY);});
    return {phase:'during',day,totalDays,here};}
  return {phase:'after',when:end};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderCountdown(state){
  const el=document.getElementById('countdown');if(!el)return;const c=countdown(state);
  if(!c){el.hidden=true;return;}el.hidden=false;
  const fmt=d=>d.toLocaleString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  if(c.phase==='before')el.innerHTML=`<div class="cd-units"><span><b>${c.d}</b>Tage</span><span><b>${c.h}</b>Std.</span><span><b>${c.m}</b>Min.</span></div><p>${esc(c.label)} · ${esc(fmt(c.when))} Uhr</p>`;
  else if(c.phase==='during')el.innerHTML=`<div class="cd-units"><span><b>${c.day}</b>Reisetag</span><span><b>${c.totalDays}</b>Tage gesamt</span></div><p>${c.here?'Heute: '+esc(c.here.name)+(root.TravelCore&&root.TravelCore.aboard(c.here)&&(c.here.end||c.here.start)===new Date().toLocaleDateString('sv-SE')?' · <strong>'+esc(root.TravelCore.aboardLabel(c.here))+'</strong>':''):(root.TravelCore&&root.TravelCore.cruise?'Heute auf See':'Heute unterwegs')}</p>`;
  else el.innerHTML=`<p class="cd-done">Reise beendet am ${esc(fmt(c.when))} Uhr – willkommen zurück!</p>`;
}
root.TravelCountdown={countdown,renderCountdown};
})(globalThis);
