'use strict';
/* Tab „Reisekasse“: Ausgaben in beliebiger Währung, umgerechnet in Euro (Kurs wird mit der Ausgabe gespeichert),
   Budget, Kategorien, wer hat bezahlt und wer schuldet wem. Kurse: Frankfurter-API (Referenzkurse von Zentralbanken),
   zwischengespeichert für offline; jeder Kurs lässt sich von Hand ändern. Einträge liegen in state.expenses. */
(function(){
const q=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EN=()=>globalThis.RA_LANG==='en';const L=(de,en)=>EN()?en:de;
const loc=()=>EN()?'en-GB':'de-DE';
function trip(){try{return state;}catch{return {destinations:[],settings:{},expenses:[]};}}
const HOME=()=>trip().settings?.budget?.home||'EUR';
const money=(v,cur=HOME())=>{try{return new Intl.NumberFormat(loc(),{style:'currency',currency:cur,maximumFractionDigits:cur==='JPY'||cur==='KRW'||cur==='IDR'||cur==='VND'?0:2}).format(v);}catch{return v.toFixed(2)+' '+cur;}};
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function people(){const p=trip().settings?.entry?.people||[];let n=0;p.forEach((x,i)=>{if(x)n=i+1;});n=Math.max(1,n);return Array.from({length:n},(_,i)=>p[i]||L('Person ','Person ')+(i+1));}
/* Landeswährungen (ISO 4217) */
const CUR={};
for(const [c,list] of Object.entries({EUR:'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK AD MC SM VA ME XK GF GP MQ RE YT MF BL PM AX',USD:'US EC SV PA PR GU AS VI MP PW FM MH TL BQ TC VG IO',XCD:'AG DM GD KN LC VC AI MS',XOF:'BJ BF CI GW ML NE SN TG',XAF:'CM CF TD CG GQ GA',XPF:'PF NC WF',AUD:'AU CX CC NF KI NR TV',NZD:'NZ CK NU PN TK',GBP:'GB GG JE IM',CHF:'CH LI',DKK:'DK GL FO',NOK:'NO SJ BV',ANG:'CW SX',ZAR:'ZA LS NA',INR:'IN BT'}))for(const cc of list.split(' '))CUR[cc]=c;
Object.assign(CUR,{SE:'SEK',IS:'ISK',PL:'PLN',CZ:'CZK',HU:'HUF',RO:'RON',BG:'BGN',RS:'RSD',BA:'BAM',MK:'MKD',AL:'ALL',MD:'MDL',UA:'UAH',BY:'BYN',RU:'RUB',TR:'TRY',GE:'GEL',AM:'AMD',AZ:'AZN',IL:'ILS',PS:'ILS',JO:'JOD',LB:'LBP',SY:'SYP',IQ:'IQD',IR:'IRR',SA:'SAR',AE:'AED',QA:'QAR',BH:'BHD',KW:'KWD',OM:'OMR',YE:'YER',EG:'EGP',MA:'MAD',DZ:'DZD',TN:'TND',LY:'LYD',KE:'KES',TZ:'TZS',UG:'UGX',RW:'RWF',ET:'ETB',NG:'NGN',GH:'GHS',MU:'MUR',SC:'SCR',MG:'MGA',MZ:'MZN',BW:'BWP',ZM:'ZMW',ZW:'ZWG',CV:'CVE',GM:'GMD',SL:'SLE',LR:'LRD',GN:'GNF',SD:'SDG',SS:'SSP',DJ:'DJF',ER:'ERN',SO:'SOS',MW:'MWK',AO:'AOA',CD:'CDF',BI:'BIF',KM:'KMF',ST:'STN',SZ:'SZL',MR:'MRU',
  CN:'CNY',HK:'HKD',MO:'MOP',TW:'TWD',JP:'JPY',KR:'KRW',KP:'KPW',MN:'MNT',TH:'THB',VN:'VND',KH:'KHR',LA:'LAK',MM:'MMK',MY:'MYR',SG:'SGD',BN:'BND',ID:'IDR',PH:'PHP',LK:'LKR',MV:'MVR',NP:'NPR',BD:'BDT',PK:'PKR',AF:'AFN',KZ:'KZT',UZ:'UZS',KG:'KGS',TJ:'TJS',TM:'TMT',FJ:'FJD',PG:'PGK',SB:'SBD',VU:'VUV',WS:'WST',TO:'TOP',
  CA:'CAD',MX:'MXN',GT:'GTQ',BZ:'BZD',HN:'HNL',NI:'NIO',CR:'CRC',CU:'CUP',JM:'JMD',HT:'HTG',DO:'DOP',BS:'BSD',BB:'BBD',TT:'TTD',AW:'AWG',KY:'KYD',BM:'BMD',CO:'COP',VE:'VES',GY:'GYD',SR:'SRD',BR:'BRL',PE:'PEN',BO:'BOB',PY:'PYG',UY:'UYU',AR:'ARS',CL:'CLP',FK:'FKP',SH:'SHP',GI:'GIP'});
/* ---------- Wechselkurse ---------- */
const FXKEY='rau.fx.v1';let fx=null;try{fx=JSON.parse(localStorage.getItem(FXKEY)||'null');}catch{}
let fxBusy=false,fxError='';
function parseRates(j){const out={};if(!j)return out;if(Array.isArray(j)){for(const r of j){const k=r.quote||r.currency||r.symbol,v=Number(r.rate??r.value);if(k&&v>0)out[String(k).toUpperCase()]=v;}}else if(j.rates&&typeof j.rates==='object'){for(const [k,v] of Object.entries(j.rates))if(Number(v)>0)out[k.toUpperCase()]=Number(v);}return out;}
async function refreshFx(force=false){if(fxBusy)return;if(!force&&fx&&Date.now()-fx.fetched<12*3600000)return;if(!navigator.onLine){fxError='offline';return;}fxBusy=true;
  try{let rates={};for(const url of ['https://api.frankfurter.dev/v2/rates?base=EUR','https://api.frankfurter.dev/v1/latest','https://api.frankfurter.app/latest']){try{const c=new AbortController(),t=setTimeout(()=>c.abort(),10000);const r=await fetch(url,{signal:c.signal});clearTimeout(t);if(!r.ok)continue;rates=parseRates(await r.json());if(Object.keys(rates).length>10)break;}catch{}}
    if(Object.keys(rates).length<10)throw Error('no rates');rates.EUR=1;fx={fetched:Date.now(),rates};try{localStorage.setItem(FXKEY,JSON.stringify(fx));}catch{}fxError='';}
  catch{fxError='failed';}finally{fxBusy=false;render();}}
/* Kurs: 1 Einheit der Fremdwährung = x Heimatwährung */
function rateFor(cur){const home=HOME();if(cur===home)return 1;const r=fx?.rates;if(!r||!r[cur]||!r[home])return 0;return r[home]/r[cur];}
const homeAmount=x=>x.rate>0?x.amount*x.rate:null;
/* ---------- Auswertung ---------- */
const CATS={unterkunft:['Unterkunft','Accommodation','🛏'],essen:['Essen & Trinken','Food & drink','🍽'],transport:['Transport','Transport','🚌'],ausfluege:['Ausflüge & Eintritt','Excursions & tickets','🎟'],einkauf:['Einkäufe & Souvenirs','Shopping & souvenirs','🛍'],gebuehren:['Gebühren & Visa','Fees & visas','🧾'],sonstiges:['Sonstiges','Other','•']};
const catLabel=k=>{const c=CATS[k]||CATS.sonstiges;return L(c[0],c[1]);};
function stats(){const ex=trip().expenses||[],ppl=people(),n=ppl.length;const paid=Array(n).fill(0),owe=Array(n).fill(0);let total=0,missing=0;const byCat={};
  for(const x of ex){const v=homeAmount(x);if(v===null){missing++;continue;}total+=v;byCat[x.cat]=(byCat[x.cat]||0)+v;const payer=Math.min(x.payer,n-1);paid[payer]+=v;const split=(x.split.length?x.split:ppl.map((_,i)=>i)).filter(i=>i<n);const share=v/(split.length||1);for(const i of split)owe[i]+=share;}
  const bal=paid.map((p,i)=>p-owe[i]);
  /* Ausgleich: wer zu wenig gezahlt hat, zahlt an wen zu viel gezahlt hat */
  const debt=bal.map((b,i)=>({i,b})).filter(x=>x.b<-0.005).sort((a,b)=>a.b-b.b),cred=bal.map((b,i)=>({i,b})).filter(x=>x.b>0.005).sort((a,b)=>b.b-a.b),moves=[];
  let di=0,ci=0;while(di<debt.length&&ci<cred.length){const amt=Math.min(-debt[di].b,cred[ci].b);moves.push({from:debt[di].i,to:cred[ci].i,amt});debt[di].b+=amt;cred[ci].b-=amt;if(debt[di].b>-0.005)di++;if(cred[ci].b<0.005)ci++;}
  return {total,missing,byCat,paid,owe,moves,count:ex.length};}
function planned(){let sum=0,miss=0;for(const d of trip().destinations||[])for(const day of d.planning?.days||[])for(const x of day.excursions||[]){if(x.cost===''||x.cost===undefined)continue;const r=x.currency===HOME()?1:rateFor(x.currency);if(r)sum+=x.cost*r;else miss++;}return {sum,miss};}
function tripDays(){const ds=trip().destinations||[];if(!ds.length)return null;const s=ds.map(d=>d.start).sort()[0],e=ds.map(d=>d.end||d.start).sort().at(-1);return {start:s,end:e,days:Math.round((Date.parse(e)-Date.parse(s))/86400000)+1};}
function currentCountry(){const ds=[...(trip().destinations||[])].sort((a,b)=>a.start.localeCompare(b.start)),t=iso(new Date());const d=ds.find(x=>(x.end||x.start)>=t)||ds.at(-1);return d?.country||'';}
/* ---------- Darstellung ---------- */
let editing=null,showForm=false;
function curOptions(sel){const route=[...new Set((trip().destinations||[]).map(d=>CUR[d.country]).filter(Boolean))];const common=['EUR','USD','GBP','CHF'];const all=[...new Set([HOME(),...route,...common,...Object.keys(fx?.rates||{}).sort()])];
  let names=null;try{names=new Intl.DisplayNames([loc()],{type:'currency'});}catch{}
  return all.map(c=>`<option value="${c}"${c===sel?' selected':''}>${c}${names?' · '+h(names.of(c)):''}</option>`).join('');}
function formHtml(x){const ppl=people(),dests=[...(trip().destinations||[])].sort((a,b)=>a.start.localeCompare(b.start));const d=x||{};const cur=d.currency||CUR[currentCountry()]||HOME();const rate=d.rate||rateFor(cur)||'';
  const t=iso(new Date()),td=tripDays();const date=d.date||(td&&t>=td.start&&t<=td.end?t:(td?td.start:t));
  return `<form id="bk-form" class="panel bk-form" data-id="${h(d.id||'')}"><h3>${x?L('Ausgabe bearbeiten','Edit expense'):L('Neue Ausgabe','New expense')}</h3><div class="form-grid">
  <label>${L('Betrag','Amount')} *<input name="amount" type="number" step="0.01" min="0" inputmode="decimal" required value="${d.amount??''}"></label>
  <label>${L('Währung','Currency')}<select name="currency">${curOptions(cur)}</select></label>
  <label class="wide">${L('Wofür?','What for?')}<input name="title" maxlength="200" value="${h(d.title||'')}" placeholder="${L('z. B. Abendessen am Hafen','e.g. dinner at the harbour')}"></label>
  <label>${L('Kategorie','Category')}<select name="cat">${Object.keys(CATS).map(k=>`<option value="${k}"${(d.cat||'essen')===k?' selected':''}>${CATS[k][2]} ${h(catLabel(k))}</option>`).join('')}</select></label>
  <label>${L('Datum','Date')}<input name="date" type="date" value="${h(date)}"></label>
  <label>${L('Bezahlt von','Paid by')}<select name="payer">${ppl.map((n,i)=>`<option value="${i}"${(d.payer||0)===i?' selected':''}>${h(n)}</option>`).join('')}</select></label>
  <label>${L('Station','Stop')}<select name="destinationId"><option value="">–</option>${dests.map(s=>`<option value="${h(s.id)}"${d.destinationId===s.id?' selected':''}>${h(s.name)}</option>`).join('')}</select></label>
  ${ppl.length>1?`<fieldset class="wide bk-split"><legend>${L('Aufgeteilt auf','Split between')}</legend>${ppl.map((n,i)=>`<label class="checkbox-label"><input type="checkbox" name="split" value="${i}"${!d.split||!d.split.length||d.split.includes(i)?' checked':''}> ${h(n)}</label>`).join('')}</fieldset>`:''}
  <label class="wide">${L('Kurs','Rate')}: 1 <span data-bk-cur>${h(cur)}</span> = <input name="rate" type="number" step="any" min="0" value="${rate}" class="bk-rate" inputmode="decimal"> ${h(HOME())} <small class="field-hint" data-bk-rate-hint>${fx?L('Aktueller Referenzkurs vorausgefüllt – bei Kartenzahlung ggf. Kurs der Bankabrechnung eintragen.','Current reference rate pre-filled – for card payments enter your bank\'s rate if you like.'):L('Noch keine Kurse geladen – Kurs von Hand eintragen oder online „Kurse aktualisieren“.','No rates loaded yet – enter the rate yourself or “Update rates” while online.')}</small></label>
  <label class="wide">${L('Notiz','Note')}<input name="note" maxlength="1000" value="${h(d.note||'')}"></label></div>
  <div class="button-row"><button class="primary">${L('Speichern','Save')}</button><button type="button" class="secondary" id="bk-cancel">${L('Abbrechen','Cancel')}</button>${x?`<button type="button" class="danger-btn" data-bk-del="${h(x.id)}">${L('Löschen','Delete')}</button>`:''}</div></form>`;}
function render(){const el=q('#reisekasse');if(!el||el.hidden)return;const box=q('#reisekasse-content');if(!box)return;
  const s=stats(),ppl=people(),budget=trip().settings?.budget?.total||null,td=tripDays(),pl=planned(),ex=[...(trip().expenses||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const pct=budget?Math.min(100,Math.round(s.total/budget*100)):0;const today=iso(new Date());const daysDone=td?Math.max(1,Math.min(td.days,Math.round((Date.parse(today)-Date.parse(td.start))/86400000)+1)):null;
  const byDate=new Map();for(const x of ex){const k=x.date||'';if(!byDate.has(k))byDate.set(k,[]);byDate.get(k).push(x);}
  box.innerHTML=`<div class="bk-top"><section class="panel bk-sum"><div class="eyebrow">${L('AUSGEGEBEN','SPENT')}</div><div class="bk-big">${money(s.total)}</div>
    ${budget?`<div class="en-bar bk-bar${s.total>budget?' over':''}"><i style="width:${pct}%"></i></div><p class="small">${L('Budget','Budget')} ${money(budget)} · ${s.total>budget?L('überschritten um ','over by ')+money(s.total-budget):L('noch ','left ')+money(budget-s.total)}</p>`:''}
    ${td&&s.count&&today>=td.start?`<p class="small">${L('Im Schnitt','Average')} ${money(s.total/daysDone)} ${L('pro Tag','per day')}${budget&&today<=td.end?' · '+L('verfügbar ','available ')+money(Math.max(0,budget-s.total)/Math.max(1,td.days-daysDone+1))+' '+L('pro restlichem Tag','per remaining day'):''}</p>`:''}
    ${pl.sum?`<p class="small">${L('Geplante Ausflüge laut Planung','Planned excursions from planning')}: ${money(pl.sum)}</p>`:''}
    ${s.missing?`<p class="em-warn">⚠ ${L(`${s.missing} Ausgabe(n) ohne Kurs werden nicht mitgezählt.`,`${s.missing} expense(s) without a rate are not counted.`)}</p>`:''}
    <form id="bk-budget" class="button-row bk-budget"><label>${L('Budget','Budget')} (${h(HOME())})<input name="total" type="number" min="0" step="1" value="${budget||''}" placeholder="${L('optional','optional')}"></label><button class="secondary small-btn">${L('Festlegen','Set')}</button></form></section>
    <section class="panel bk-cats"><h3>${L('Nach Kategorie','By category')}</h3>${Object.keys(s.byCat).length?`<ul class="bk-catlist">${Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<li><span>${CATS[k]?.[2]||'•'} ${h(catLabel(k))}</span><b>${money(v)}</b><div class="en-bar"><i style="width:${s.total?Math.round(v/s.total*100):0}%"></i></div></li>`).join('')}</ul>`:`<p class="muted">${L('Noch keine Ausgaben.','No expenses yet.')}</p>`}</section>
    ${ppl.length>1?`<section class="panel bk-people"><h3>${L('Wer hat bezahlt?','Who paid?')}</h3><ul class="bk-catlist">${ppl.map((n,i)=>`<li><span>${h(n)}</span><b>${money(s.paid[i])}</b><small>${L('Anteil','Share')} ${money(s.owe[i])}</small></li>`).join('')}</ul>
      <h4>${L('Ausgleich','Settle up')}</h4>${s.moves.length?`<ul class="bk-moves">${s.moves.map(m=>`<li>${h(ppl[m.from])} → ${h(ppl[m.to])}: <b>${money(m.amt)}</b></li>`).join('')}</ul>`:`<p class="muted">${L('Alles ausgeglichen.','All square.')}</p>`}</section>`:''}</div>
  <div class="button-row bk-actions"><button type="button" class="primary" id="bk-new">＋ ${L('Ausgabe eintragen','Add expense')}</button><button type="button" class="secondary small-btn" id="bk-fx">↻ ${L('Kurse aktualisieren','Update rates')}</button><span class="small">${fx?L('Kurse vom ','Rates from ')+new Date(fx.fetched).toLocaleDateString(loc())+(fxError?' · '+L('Aktualisierung fehlgeschlagen','update failed'):''):(fxError?L('Kurse konnten nicht geladen werden.','Rates could not be loaded.'):L('Kurse werden geladen …','Loading rates …'))}</span></div>
  ${showForm||editing?formHtml(editing?ex.find(x=>x.id===editing):null):''}
  ${ppl.length<2?`<p class="small">${L('Tipp: Mit mehreren Reisenden (unter „Einreise“ → „Reisende eintragen“) zeigt die Kasse, wer wie viel bezahlt hat und wer wem etwas schuldet.','Tip: with several travellers (under “Entry” → “Enter travellers”) the kitty shows who paid what and who owes whom.')}</p>`:''}
  ${[...byDate].map(([d,xs])=>`<section class="panel bk-day"><h3>${d?h(new Date(d+'T12:00').toLocaleDateString(loc(),{weekday:'long',day:'numeric',month:'long',year:'numeric'})):L('Ohne Datum','No date')} <span class="number">${money(xs.reduce((a,x)=>a+(homeAmount(x)||0),0))}</span></h3><ul class="bk-list">${xs.map(x=>`<li><button type="button" class="bk-row" data-bk-edit="${h(x.id)}"><span class="bk-icon" aria-hidden="true">${CATS[x.cat]?.[2]||'•'}</span><span class="bk-main"><strong>${h(x.title||catLabel(x.cat))}</strong><small>${h(ppl[Math.min(x.payer,ppl.length-1)])}${x.split.length&&x.split.length<ppl.length?' · '+L('für ','for ')+x.split.map(i=>h(ppl[i]||'')).join(', '):''}</small></span><span class="bk-amt"><b>${homeAmount(x)===null?'?':money(homeAmount(x))}</b>${x.currency!==HOME()?`<small>${money(x.amount,x.currency)}</small>`:''}</span></button></li>`).join('')}</ul></section>`).join('')}`;}
async function save(list){const s=trip();return commit({...s,expenses:list},false);}
function formData(f){const el=f.elements;const amount=parseFloat(String(el.amount.value).replace(',','.'));if(!Number.isFinite(amount)||amount<0)throw Error(L('Bitte einen gültigen Betrag eingeben.','Please enter a valid amount.'));
  const split=el.split?[...f.querySelectorAll('input[name=split]:checked')].map(x=>+x.value):[];const ppl=people();
  return {id:f.dataset.id||crypto.randomUUID(),amount,currency:el.currency.value,title:el.title.value.trim(),cat:el.cat.value,date:el.date.value,payer:+el.payer.value,split:split.length===ppl.length?[]:split,destinationId:el.destinationId.value,rate:parseFloat(String(el.rate.value).replace(',','.'))||0,note:el.note.value.trim()};}
document.addEventListener('click',async e=>{const t=e.target;if(!t.closest?.('#reisekasse'))return;
  if(t.closest('#bk-new')){showForm=true;editing=null;render();q('#bk-form [name=amount]')?.focus();return;}
  if(t.closest('#bk-cancel')){showForm=false;editing=null;render();return;}
  if(t.closest('#bk-fx')){fxError='';refreshFx(true);return;}
  const ed=t.closest('[data-bk-edit]');if(ed){editing=ed.dataset.bkEdit;showForm=false;render();q('#bk-form')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  const del=t.closest('[data-bk-del]');if(del){const ok=await confirmAction(L('Ausgabe löschen?','Delete expense?'),L('Die Ausgabe wird aus der Reisekasse entfernt.','The expense will be removed from the kitty.'),[{label:L('Abbrechen','Cancel'),value:false},{label:L('Löschen','Delete'),value:true,className:'danger-btn'}]);
    if(ok&&await save((trip().expenses||[]).filter(x=>x.id!==del.dataset.bkDel))){editing=null;render();}}});
document.addEventListener('change',e=>{const t=e.target;if(t.name==='currency'&&t.closest?.('#bk-form')){const f=t.form;f.querySelector('[data-bk-cur]').textContent=t.value;const r=rateFor(t.value);f.elements.rate.value=r?+r.toPrecision(6):'';}});
document.addEventListener('submit',async e=>{const f=e.target;
  if(f.id==='bk-budget'){e.preventDefault();const v=parseFloat(f.elements.total.value);const s=trip();if(await commit({...s,settings:{...s.settings,budget:{...(s.settings.budget||{}),total:Number.isFinite(v)&&v>0?v:null}}},false)){render();notify(L('Budget gespeichert.','Budget saved.'));}return;}
  if(f.id!=='bk-form')return;e.preventDefault();try{const x=formData(f);if(!x.rate&&x.currency!==HOME())notify(L('Ohne Kurs wird die Ausgabe nicht mitgezählt – Kurs später ergänzen.','Without a rate the expense is not counted – add the rate later.'));
    const list=trip().expenses||[];const next=list.some(y=>y.id===x.id)?list.map(y=>y.id===x.id?x:y):[...list,x];if(await save(next)){showForm=false;editing=null;render();notify(L('Ausgabe gespeichert.','Expense saved.'));}}catch(err){notify(err.message);}});
function homeLine(){const s=stats();if(!s.count)return '';const b=trip().settings?.budget?.total;return L('Ausgegeben ','Spent ')+money(s.total)+(b?' / '+money(b):'');}
window.TravelBudget={show(){render();refreshFx(false);},onTrip(){if(!editing&&!showForm)render();},homeLine,CUR};
const wait=setInterval(()=>{let r=false;try{r=ready;}catch{}if(r){clearInterval(wait);if(location.hash==='#reisekasse'){render();refreshFx(false);}}},150);
})();
