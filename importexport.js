'use strict';
/* Route importieren (Kalenderdatei .ics, Tabelle .csv, eingefügter Reiseverlauf als Text) mit Vorschau,
   Route als Kalenderdatei (.ics) exportieren. Orte werden über die eingebaute Ortsliste (cities.json) erkannt. */
(function(root){
const q=s=>document.querySelector(s);
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ß/g,'ss').trim();
const pad=n=>String(n).padStart(2,'0');
const isoOf=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const lang=()=>root.RA_LANG||'de';

/* ---------- Länder- und Ortserkennung ---------- */
let countryIndex=null;
function countries(){if(countryIndex)return countryIndex;countryIndex=new Map();const codes=root.TravelCore.codes;
  for(const l of ['de','en','fr','es','it']){let dn=null;try{dn=new Intl.DisplayNames([l],{type:'region'});}catch{continue;}for(const c of codes){try{const n=dn.of(c);if(n)countryIndex.set(fold(n),c);}catch{}}}
  for(const [k,v] of Object.entries({usa:'US','vereinigte staaten':'US',amerika:'US',england:'GB',schottland:'GB',wales:'GB',grossbritannien:'GB','great britain':'GB',uk:'GB',holland:'NL',tuerkei:'TR',turkiye:'TR',tschechien:'CZ',russland:'RU',suedkorea:'KR','south korea':'KR',korea:'KR',vietnam:'VN','vae':'AE',dubai:'AE',bali:'ID',hawaii:'US',kanaren:'ES',mallorca:'ES',madeira:'PT',azoren:'PT',sizilien:'IT',sardinien:'IT',korsika:'FR',kreta:'GR',tahiti:'PF'}))countryIndex.set(k,v);
  for(const c of codes)countryIndex.set(c.toLowerCase(),c);return countryIndex;}
function countryOf(text){const t=fold(text).replace(/[().]/g,'').trim();if(!t)return '';const idx=countries();if(idx.has(t))return idx.get(t);return '';}
/* Deutsche und gebräuchliche Namen, die in der Ortsliste anders heißen */
const ALIAS=Object.fromEntries(Object.entries({'München':'munich','Köln':'cologne','Nürnberg':'nuremberg','Wien':'vienna','Rom':'rome','Mailand':'milan','Neapel':'naples','Venedig':'venice','Florenz':'florence','Genua':'genoa','Lissabon':'lisbon','Prag':'prague','Warschau':'warsaw','Krakau':'krakow','Moskau':'moscow','Kopenhagen':'copenhagen','Brüssel':'brussels','Den Haag':'the hague','Athen':'athens','Kairo':'cairo','Peking':'beijing','Tokio':'tokyo','Neu-Delhi':'new delhi','Kapstadt':'cape town','Genf':'geneva','Zürich':'zurich','Lüttich':'liege','Antwerpen':'antwerp','Edinburg':'edinburgh','Sankt Petersburg':'saint petersburg','St. Petersburg':'saint petersburg','Marrakesch':'marrakesh','Teneriffa':'santa cruz de tenerife','Sevilla':'seville','Saragossa':'zaragoza','Belgrad':'belgrade','Bukarest':'bucharest','Kiew':'kyiv','Havanna':'havana','Mexiko-Stadt':'mexico city','New York':'new york city','Neapel':'naples','Bozen':'bolzano','Meran':'merano','Pressburg':'bratislava','Danzig':'gdansk','Breslau':'wroclaw','Stettin':'szczecin','Posen':'poznan','Reval':'tallinn','Lemberg':'lviv','Peking':'beijing','Seoul':'seoul','Singapur':'singapore','Hongkong':'hong kong','Neuseeland':'','Washington':'washington','Kanton':'guangzhou','Bombay':'mumbai','Kalkutta':'kolkata','Madras':'chennai','Lisboa':'lisbon','Frankfurt':'frankfurt am main','Frankfurt/Main':'frankfurt am main','Halle':'halle (saale)','Roma':'rome','Milano':'milan','Napoli':'naples','Venezia':'venice','Firenze':'florence','Torino':'turin','Genova':'genoa','Praha':'prague','Warszawa':'warsaw','Kraków':'krakow','København':'copenhagen','Bruxelles':'brussels','Brussel':'brussels','Athina':'athens','Moskva':'moscow','Sevilla':'seville','Wien':'vienna','Den Haag':'the hague','Nürnberg':'nuremberg','Göteborg':'gothenburg','Ciudad de México':'mexico city','Al Qahirah':'cairo','Kobenhavn':'copenhagen'}).filter(([,v])=>v).map(([k,v])=>[fold(k),v]));
let places=null;
async function loadPlaces(){if(places)return places;const r=await fetch('cities.json');if(!r.ok)throw Error('Ortsliste fehlt');places=(await r.json()).map(c=>({n:c[0],cc:c[2],lat:c[3],lng:c[4],f:fold(c[0]),f2:fold(c[1])}));return places;}
function findPlace(text,cc){if(!places)return null;let t=fold(text).replace(/[()]/g,'').replace(/\s+/g,' ').trim();if(!t)return null;if(ALIAS[t])t=ALIAS[t];
  let best=null;for(const p of places){if(p.f!==t&&p.f2!==t)continue;if(cc&&p.cc!==cc)continue;best=p;break;}return best;}
/* Alle gleichnamigen Orte (für Mehrdeutigkeiten wie Portland oder Victoria) */
function findAll(text,cc){if(!places)return [];let t=fold(text).replace(/[()]/g,'').replace(/\s+/g,' ').trim();if(ALIAS[t])t=ALIAS[t];return places.filter(p=>(p.f===t||p.f2===t)&&(!cc||p.cc===cc)).slice(0,40);}
const dist=(a,b)=>{const r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dn=r(b.lng-a.lng);const x=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dn/2)**2;return 2*6371*Math.asin(Math.sqrt(x));};
/* „Paris, Frankreich“ → Ort + Land; „Seetag“ usw. bleiben ohne Ort. */
function resolve(raw,ccHint='',near=null){const parts=String(raw||'').split(/[,;|–—()]/).map(s=>s.trim()).filter(Boolean);let cc=ccHint&&root.TravelCore.codes.includes(ccHint)?ccHint:'';
  if(!cc&&parts.length>1){const c=countryOf(parts.at(-1));if(c){cc=c;parts.pop();}}
  if(!cc&&parts.length===1){const c=countryOf(parts[0]);if(c)cc=c;}
  const label=parts.join(', ');const tries=[];for(const p of parts){tries.push(p);const w=p.split(/\s+/);for(let n=w.length-1;n>=1;n--)tries.push(w.slice(0,n).join(' '));}
  /* Adressen: Postleitzahl abtrennen („1250-096 Lisboa“, „75008 Paris“) */
  for(const p of parts){const m=/^[\dA-Z-]{3,10}\s+(.+)$/.exec(p);if(m)tries.unshift(m[1]);}
  for(const p of tries){if(p.length<3)continue;let hit=cc?findPlace(p,cc):null;
    /* Ohne Land: bei mehreren gleichnamigen Orten den nächstgelegenen zur vorigen Station nehmen */
    if(!hit&&!cc){const all=findAll(p,'');if(all.length){hit=all[0];if(near&&all.length>1)hit=all.reduce((b,x)=>dist(near,x)<dist(near,b)?x:b,all[0]);}}
    if(hit)return {cc:cc||hit.cc,city:hit.n,lat:hit.lat,lng:hit.lng,label};}
  return {cc,city:/\d/.test(parts[0]||'')?'':(parts[0]||''),lat:null,lng:null,label};}

/* ---------- Datumserkennung (Text) ---------- */
const MONTHS={jan:1,januar:1,january:1,jaenner:1,feb:2,februar:2,february:2,maer:3,maerz:3,mrz:3,mar:3,march:3,apr:4,april:4,mai:5,may:5,jun:6,juni:6,june:6,jul:7,juli:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,okt:10,oktober:10,oct:10,october:10,nov:11,november:11,dez:12,dezember:12,dec:12,december:12};
const MON_RE='(jan(?:uar|uary)?|j[aä]nner|feb(?:ruar|ruary)?|m[aä]r(?:z|ch)?|mrz|apr(?:il)?|mai|may|jun[ie]?|june|jul[iy]?|aug(?:ust)?|sept?(?:ember)?|o[ck]t(?:ober)?|nov(?:ember)?|de[zc](?:ember)?)\\.?';
function monthNum(w){return MONTHS[fold(w).replace(/\./g,'').replace(/ae/g,'ae')]||MONTHS[fold(w).replace(/\./g,'').slice(0,3)]||0;}
/* Liefert alle Datumsangaben einer Zeile mit Position; Jahr kann fehlen (null). */
function datesIn(line){const out=[];const L=line;let m;
  const reISO=/(\d{4})-(\d{1,2})-(\d{1,2})/g;while((m=reISO.exec(L)))out.push({i:m.index,len:m[0].length,y:+m[1],mo:+m[2],d:+m[3]});
  const reDE=/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?![\d])/g;while((m=reDE.exec(L))){if(out.some(o=>m.index>=o.i&&m.index<o.i+o.len))continue;let y=m[3]?+m[3]:null;if(y!==null&&y<100)y+=2000;out.push({i:m.index,len:m[0].length,y,mo:+m[2],d:+m[1]});}
  const reWord=new RegExp('(?<![\\d])(\\d{1,2})\\.?\\s*'+MON_RE+'\\s*(\\d{4})?','gi');while((m=reWord.exec(L))){if(out.some(o=>m.index>=o.i&&m.index<o.i+o.len))continue;out.push({i:m.index,len:m[0].length,y:m[3]?+m[3]:null,mo:monthNum(m[2]),d:+m[1]});}
  const reEN=new RegExp(MON_RE+'\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?','gi');while((m=reEN.exec(L))){if(out.some(o=>m.index>=o.i&&m.index<o.i+o.len))continue;out.push({i:m.index,len:m[0].length,y:m[3]?+m[3]:null,mo:monthNum(m[1]),d:+m[2]});}
  /* „24.–26.10.2027“: Tag ohne Monat vor einem Bindestrich */
  const reRange=/(?<![\d.:])(\d{1,2})\.?\s*[-–—]\s*(?=\d{1,2}\.\d{1,2}\.)/g;while((m=reRange.exec(L))){out.push({i:m.index,len:m[0].length,y:null,mo:null,d:+m[1],partial:true});}
  return out.filter(o=>o.partial||(o.mo>=1&&o.mo<=12&&o.d>=1&&o.d<=31)).sort((a,b)=>a.i-b.i);}
const TIME_RE=/(?<![\d.:])([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*(?:uhr|h))?(?![\d])/gi;
const SEA_RE=/^(seetag|auf see|at sea|sea day|day at sea|erholung auf see)$/i;

/* Zeilen aus Buchungsmails, die zwar ein Datum enthalten, aber keine Station sind */
const NOISE=/\b(buchung(?:sdatum|snummer)?|gebucht am|rechnung|zahlung|bezahlt|anzahlung|restzahlung|f[äa]llig|storn\w*|geburt\w*|g[üu]ltig|ausgestellt|frist|bestätigt am|bestaetigt|reisepass|invoice|payment|paid|booking date|booked on|issued|cancell?ation|deadline|date of birth|expires?|valid)\b/i;
function parseText(text,skip=null){const rows=[];let lastYear=null,lastISO=null;const year0=new Date().getFullYear();
  const all=String(text).split(/\r?\n/);for(let li=0;li<all.length;li++){if(skip&&skip.has(li))continue;let line=all[li].replace(/\t+/g,' | ').trim();if(line.includes(' | ')||/\|/.test(line))line=line.split('|').map(c=>c.trim()).filter(c=>c&&!/^\d{1,3}$/.test(c)&&!/^[-–—]+$/.test(c)).join(' ');if(!line||NOISE.test(line))continue;const ds=datesIn(line);if(!ds.length)continue;
    const full=ds.filter(d=>!d.partial);if(!full.length)continue;
    const fix=d=>{let y=d.y;if(y===null){y=lastYear||year0;let s=isoOf(y,d.mo,d.d);if(lastISO&&s<lastISO&&!d.y)s=isoOf(++y,d.mo,d.d);return s;}return isoOf(y,d.mo,d.d);};
    let start=fix(full[0]);let end='';
    const partial=ds.find(d=>d.partial&&d.i<full[0].i);if(partial){const e=start;start=isoOf(+e.slice(0,4),full[0].mo,partial.d);end=e;}
    else if(full[1]){end=fix(full[1]);if(full[1].y&&!full[0].y){start=isoOf(full[1].y,full[0].mo,full[0].d);if(start>end)start=isoOf(full[1].y-1,full[0].mo,full[0].d);}}
    if(!valid(start)||(end&&!valid(end)))continue;if(end&&end<start)end='';
    lastYear=+((end||start).slice(0,4));lastISO=end||start;
    let rest=line;for(const d of [...ds].sort((a,b)=>b.i-a.i))rest=rest.slice(0,d.i)+' '+rest.slice(d.i+d.len);
    const times=[...rest.matchAll(TIME_RE)].map(m=>({t:pad(+m[1])+':'+m[2],dep:/(?:^|\s)(ab|dep\w*|abfahrt|abreise|departure)\.?:?\s*$/i.test(rest.slice(0,m.index))}));
    let arrival='',departure='';for(const x of times){if(x.dep&&!departure)departure=x.t;else if(!arrival&&!departure)arrival=x.t;else if(!departure)departure=x.t;}
    rest=rest.replace(TIME_RE,' ').replace(/(^|\s)(mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\.?,?(?=\s|$)/gi,' ').replace(/\b(tag|day)\s*\d+\b/gi,' ').replace(/\b(an|ab|bis|von|arr|dep|arrival|departure|ankunft|abfahrt|abreise|uhr)\b\.?:?/gi,' ').replace(/^[\s\-–—:·|,.]+|[\s\-–—:·|,.]+$/g,'').replace(/\s*[-–—·|]\s*$/,'').replace(/\s{2,}/g,' ').trim();
    if(!rest)continue;const sea=SEA_RE.test(rest);
    rows.push({name:rest,start,end:end||'',arrival,departure,sea,place:sea?'':rest});}
  return rows;}

/* ---------- Buchungsbestätigungen: Hotels und Flüge über mehrere Zeilen ---------- */
const HOTEL_WORD=/\b(hotel|resort|inn|lodge|hostel|pension|gasthof|gasthaus|apartments?|appartements?|ferienwohnung|ferienhaus|villa|suites?|b&b|bed and breakfast|ryokan|riad|camping|unterkunft|accommodation|property)\b/i;
const CHECKIN=/\b(check-?in|anreise|arrival|ankunft am)\b/i,CHECKOUT=/\b(check-?out|abreise|departure|abreisetag)\b/i;
const LABEL_RE=/^(hotel|unterkunft|accommodation|property|name|adresse|address|anschrift|telefon|phone|tel)\s*[:.]\s*/i;
function firstDate(lines,i,year){for(let k=i;k<Math.min(lines.length,i+3);k++){const d=datesIn(lines[k]).find(x=>!x.partial);if(d)return {iso:isoOf(d.y?(d.y<100?d.y+2000:d.y):year,d.mo,d.d),line:k,hasYear:!!d.y};}return null;}
function timeNear(lines,i){for(let k=i;k<Math.min(lines.length,i+3);k++){let rest=lines[k];for(const d of datesIn(rest).sort((a,b)=>b.i-a.i))rest=rest.slice(0,d.i)+' '+rest.slice(d.i+d.len);
  const m=[...rest.matchAll(/(?<![\d.:])([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm|a\.m\.|p\.m\.)?/gi)][0];if(m){let H=+m[1];const ap=(m[3]||'').toLowerCase();if(ap.startsWith('p')&&H<12)H+=12;if(ap.startsWith('a')&&H===12)H=0;return pad(H)+':'+m[2];}}return '';}
function clean(l){return l.replace(/^(your (?:reservation|booking|stay) (?:at|in)|ihre (?:reservierung|buchung) (?:im|in|für|bei)|reservierung (?:im|in|für)|buchung (?:im|in|für)|willkommen im|welcome to)\s+/i,'').replace(LABEL_RE,'').replace(/^[\s\-–—:·|*•]+|[\s\-–—:·|*•]+$/g,'').trim();}
function extractBooking(text){const lines=String(text).split(/\r?\n/).map(l=>l.trim());const used=new Set(),rows=[];const year=new Date().getFullYear();
  /* Hotels: jedes Check-in mit dem nächsten Check-out */
  for(let i=0;i<lines.length;i++){if(!CHECKIN.test(lines[i])||used.has(i))continue;const ci=firstDate(lines,i,year);if(!ci)continue;
    let j=-1;for(let k=ci.line;k<Math.min(lines.length,i+14);k++)if(CHECKOUT.test(lines[k])&&k!==i){j=k;break;}
    const co=j>=0?firstDate(lines,j,+ci.iso.slice(0,4)):null;
    /* Name: Zeile mit Hotel-Wort in der Nähe, sonst letzte Textzeile vor Check-in */
    let name='',nameLine=-1;for(let k=i-1;k>=Math.max(0,i-10);k--){const l=lines[k];if(!l||used.has(k))continue;if(HOTEL_WORD.test(l)&&!/\d{2}[.:]\d{2}/.test(l)&&l.length<90){name=clean(l);nameLine=k;break;}}
    if(!name)for(let k=i-1;k>=Math.max(0,i-4);k--){const l=lines[k];if(l&&!datesIn(l).length&&/[A-Za-zÄÖÜäöü]{3}/.test(l)&&l.length<80&&!CHECKOUT.test(l)){name=clean(l);nameLine=k;break;}}
    if(!name)continue;
    let addr='',phone='';const from=nameLine>=0?nameLine+1:Math.max(0,i-6),to=Math.min(lines.length,(j>=0?j:i)+6);
    for(let k=from;k<to;k++){const l=lines[k];if(!l||k===i||k===j)continue;const ph=/(?:tel(?:efon)?|phone|fon)\.?\s*[:.]?\s*(\+?[\d][\d ()\/.-]{6,}\d)/i.exec(l);if(ph&&!phone){phone=ph[1].trim();used.add(k);continue;}
      if(!addr&&(/^(adresse|address|anschrift)\s*[:.]/i.test(l)||(/[A-Za-zÄÖÜäöü]{3}/.test(l)&&/\d/.test(l)&&/,/.test(l)&&!datesIn(l).length&&!/[:]\d\d/.test(l)))){addr=clean(l);used.add(k);}}
    [i,ci.line,nameLine].forEach(x=>x>=0&&used.add(x));if(j>=0){used.add(j);if(co)used.add(co.line);}
    rows.push({name,start:ci.iso,end:co?co.iso:'',arrival:timeNear(lines,i),departure:j>=0?timeNear(lines,j):'',place:addr||name,kind:'unterkunft',agent:name,agentPhone:phone,berth:addr,source:'Hotel'});}
  /* Flüge: Zeile mit zwei Flughafencodes, Datum und Uhrzeiten in der Nähe */
  const CODE=/\(([A-Z]{3})\)|\b([A-Z]{3})\s*(?:-|–|—|→|->|>|nach|to)\s*([A-Z]{3})\b/g;
  for(let i=0;i<lines.length;i++){if(used.has(i))continue;const l=lines[i];const codes=[];let m;CODE.lastIndex=0;while((m=CODE.exec(l))){if(m[1])codes.push({c:m[1],i:m.index});else{codes.push({c:m[2],i:m.index});codes.push({c:m[3],i:m.index+m[0].length-3});}}
    let arrCity='',arrCode='';
    if(codes.length>=2){arrCode=codes[1].c;const before=l.slice(codes[0].i+5,codes[1].i).replace(/^[\s\-–—→>|]+|[\s\-–—→>|,]+$/g,'').replace(/\b(nach|to)\b/gi,'').trim();arrCity=before.split(/[-–—→>|]/).pop().trim();}
    else if(codes.length===1){/* Abflug und Ankunft auf getrennten Zeilen */let n=-1;for(let k=i+1;k<Math.min(lines.length,i+5);k++){CODE.lastIndex=0;const mm=CODE.exec(lines[k]);if(mm&&mm[1]){n=k;arrCode=mm[1];arrCity=lines[k].slice(0,mm.index).replace(/^(ankunft|arrival|nach|to)\s*[:.]?\s*/i,'').replace(/[\d:.]+/g,'').trim();break;}}if(n<0)continue;used.add(n);}
    else continue;
    if(!/^[A-Z]{3}$/.test(arrCode))continue;
    let win=lines.slice(i,Math.min(lines.length,i+3)).filter(x=>!NOISE.test(x)).join(' | ');if(!datesIn(win).some(d=>!d.partial))win=lines.slice(Math.max(0,i-2),i+1).filter(x=>!NOISE.test(x)).join(' | ');const ds=datesIn(win).filter(d=>!d.partial);if(!ds.length)continue;
    const d0=ds.length>1?ds[1]:ds[0],iso=isoOf(d0.y?(d0.y<100?d0.y+2000:d0.y):year,d0.mo,d0.d);
    let rest=win;for(const d of datesIn(win).sort((a,b)=>b.i-a.i))rest=rest.slice(0,d.i)+' '+rest.slice(d.i+d.len);const times=[...rest.matchAll(/(?<![\d.:])([01]?\d|2[0-3])[:.]([0-5]\d)/g)].map(x=>pad(+x[1])+':'+x[2]);
    const fl=/\b([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{2,4})\b/.exec(win.replace(/\([A-Z]{3}\)/g,''));
    for(let k=Math.max(0,i-2);k<Math.min(lines.length,i+3);k++)if((datesIn(lines[k]).length&&!NOISE.test(lines[k]))||k===i)used.add(k);
    const city=clean(arrCity).replace(/\b(airport|flughafen|intl\.?|international)\b/gi,'').trim();
    const en=lang()==='en';rows.push({name:`${en?'Flight':'Flug'} ${fl?fl[1]+' '+fl[2]+' ':''}${en?'to':'nach'} ${city||arrCode}`.replace(/\s+/g,' '),start:iso,end:'',arrival:times.length>1?times[1]:'',departure:'',place:city||arrCode,kind:'reisetag',source:'Flug',flight:true});}
  return {rows,used};}
/* Text aus Mail oder Reiseverlauf: erst Hotels/Flüge, dann zeilenweise Stationen */
function parseAny(text){const b=extractBooking(text);const rest=parseText(text,b.used);return [...b.rows,...rest].sort((a,c)=>(a.start+(a.arrival||'')).localeCompare(c.start+(c.arrival||'')));}

/* ---------- CSV ---------- */
function splitCSV(text){const delim=[';','\t',','].map(d=>[d,(text.split(/\r?\n/)[0].match(new RegExp(d==='\t'?'\t':'\\'+d,'g'))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[];let row=[],cell='',inQ=false;for(let i=0;i<text.length;i++){const c=text[i];
    if(inQ){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else inQ=false;}else cell+=c;}
    else if(c==='"')inQ=true;else if(c===delim){row.push(cell);cell='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
  if(cell||row.length){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(c=>c.trim()));}
const COLS={name:/^(name|ort|ziel|station|reiseziel|destination|place|stop|titel|title)$/,country:/^(land|country|staat|cc|laendercode)$/,city:/^(stadt|city|hafen|port|town)$/,start:/^(ankunft|start|von|from|arrival|anreise|datum|date|beginn|ab datum|startdatum)$/,end:/^(abreise|ende|bis|to|end|departure|abfahrt|enddatum|bis datum)$/,arrival:/^(ankunftszeit|uhrzeit an|an|arrival time|time in)$/,departure:/^(abreisezeit|abfahrtszeit|uhrzeit ab|ab|departure time|time out)$/,info:/^(notiz|notizen|notes|note|info|beschreibung|description|bemerkung|kommentar)$/,lat:/^(lat|latitude|breite|breitengrad)$/,lng:/^(lng|lon|long|longitude|laenge|laengengrad)$/};
function toISO(s){s=String(s||'').trim();if(!s)return '';const d=datesIn(s).find(x=>!x.partial);if(!d)return '';return d.y?isoOf(d.y<100?d.y+2000:d.y,d.mo,d.d):'';}
function toTime(s){const m=/(\d{1,2})[:.](\d{2})/.exec(String(s||''));return m&&+m[1]<24&&+m[2]<60?pad(+m[1])+':'+m[2]:'';}
function parseCSV(text){const rows=splitCSV(text.replace(/^\uFEFF/,''));if(!rows.length)return [];const head=rows[0].map(x=>fold(x).replace(/[^a-z ]/g,'').trim());const map={};
  head.forEach((x,i)=>{for(const [k,re] of Object.entries(COLS))if(map[k]===undefined&&re.test(x))map[k]=i;});
  let body=rows.slice(1);if(map.name===undefined&&map.start===undefined){/* ohne Kopfzeile: Ort; Ankunft; Abreise */map.name=0;map.start=1;map.end=2;body=rows;}
  if(map.name===undefined)map.name=map.city;
  const out=[];for(const r of body){const g=k=>map[k]!==undefined?String(r[map[k]]||'').trim():'';const start=toISO(g('start'));if(!start)continue;
    const name=g('name')||g('city');if(!name)continue;const lat=parseFloat(g('lat').replace(',','.')),lng=parseFloat(g('lng').replace(',','.'));
    out.push({name,start,end:toISO(g('end')),arrival:toTime(g('arrival')),departure:toTime(g('departure')),info:g('info'),country:g('country'),place:g('city')||name,lat:Number.isFinite(lat)?lat:null,lng:Number.isFinite(lng)?lng:null});}
  return out;}

/* ---------- iCalendar ---------- */
function icsLines(text){return String(text).replace(/\r\n[ \t]/g,'').replace(/\n[ \t]/g,'').split(/\r?\n/);}
const unesc=s=>String(s||'').replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
function icsDate(v,params){const m=/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v||'');if(!m)return null;
  if(!m[4])return {date:`${m[1]}-${m[2]}-${m[3]}`,time:'',allDay:true};
  if(m[7]){const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]));return {date:isoOf(d.getFullYear(),d.getMonth()+1,d.getDate()),time:pad(d.getHours())+':'+pad(d.getMinutes()),allDay:false};}
  return {date:`${m[1]}-${m[2]}-${m[3]}`,time:`${m[4]}:${m[5]}`,allDay:false};}
function parseICS(text){const out=[];let ev=null;
  for(const line of icsLines(text)){if(line==='BEGIN:VEVENT'){ev={};continue;}if(line==='END:VEVENT'){if(ev)out.push(ev);ev=null;continue;}if(!ev)continue;
    const i=line.indexOf(':');if(i<0)continue;const [key,...params]=line.slice(0,i).split(';');const val=line.slice(i+1);ev[key.toUpperCase()]={val,params};}
  return out.map(e=>{const s=icsDate(e.DTSTART?.val),en=icsDate(e.DTEND?.val);if(!s)return null;let end=en?en.date:'';if(en&&en.allDay)end=addDays(en.date,-1);if(end&&end<=s.date)end=end===s.date?'':'';
    const geo=(e.GEO?.val||'').split(/[;,]/).map(Number);const summary=unesc(e.SUMMARY?.val).trim(),loc=unesc(e.LOCATION?.val).trim();
    return {name:summary||loc,start:s.date,end,arrival:s.time,departure:en&&!en.allDay&&en.date===(end||s.date)?en.time:'',info:unesc(e.DESCRIPTION?.val).slice(0,2000),place:loc||summary,lat:Number.isFinite(geo[0])&&geo.length===2?geo[0]:null,lng:Number.isFinite(geo[1])&&geo.length===2?geo[1]:null};}).filter(Boolean).sort((a,b)=>(a.start+a.arrival).localeCompare(b.start+b.arrival));}

/* ---------- Vorschau und Übernahme ---------- */
let pending=[];
async function prepare(rows){await loadPlaces();const type=root.state?.settings?.tripType||(()=>{try{return state.settings.tripType;}catch{return 'rundreise';}})();
  let near=null;return rows.map(r=>{const ccGiven=r.country?(root.TravelCore.codes.includes(r.country.toUpperCase())?r.country.toUpperCase():countryOf(r.country)):'';
    const res=r.sea?{cc:'',city:'',lat:null,lng:null}:resolve(r.place||r.name,ccGiven,near);if(res.lat!==null)near={lat:res.lat,lng:res.lng};else if(r.lat!=null)near={lat:r.lat,lng:r.lng};
    const kinds=root.TravelCore.kindsFor(type);const kind=r.sea?'reisetag':r.kind&&root.TravelCore.kinds[r.kind]?r.kind:root.TravelCore.defaultKind(type);
    const name=(r.place===r.name&&res.label&&res.cc&&!ccGiven?res.label:r.name);
    return {use:!!(res.cc||ccGiven),name:String(name).slice(0,120),country:ccGiven||res.cc,city:res.city&&fold(res.city)!==fold(r.name)?res.city:'',start:r.start,end:r.end&&r.end>=r.start?r.end:'',arrival:r.arrival||'',departure:r.departure||'',info:r.info||'',lat:r.lat??res.lat,lng:r.lng??res.lng,kind,sea:!!r.sea,agent:r.agent||'',agentPhone:r.agentPhone||'',berth:r.berth||'',source:r.source||''};}).map(r=>{/* Rückflug nach Hause standardmäßig nicht übernehmen */if(r.source==='Flug'&&r.country===((()=>{try{return state.settings.home;}catch{return 'DE';}})()||'DE'))r.use=false;return r;});}
function dialog(){let d=q('#import-dialog');if(d)return d;d=document.createElement('dialog');d.id='import-dialog';d.className='import-dialog';document.body.append(d);return d;}
function countryOptions(sel){const dn=(()=>{try{return new Intl.DisplayNames([lang()],{type:'region'});}catch{return null;}})();return '<option value="">Land wählen</option>'+root.TravelCore.codes.map(c=>({c,n:dn?.of(c)||c})).sort((a,b)=>a.n.localeCompare(b.n,lang())).map(x=>`<option value="${x.c}"${x.c===sel?' selected':''}>${h(x.n)}</option>`).join('');}
function show(source){const d=dialog();const ok=pending.filter(r=>r.use).length;
  d.innerHTML=`<div class="modal-head"><div><div class="eyebrow">ROUTE IMPORTIEREN · ${h(source)}</div><h2>${pending.length} ${pending.length===1?'Station':'Stationen'} erkannt</h2></div><button type="button" class="icon-btn" data-imp-close aria-label="Schließen">×</button></div>
  <p class="small">Bitte prüfen: Name, Land und Daten lassen sich hier noch ändern. Stationen ohne Land sind nicht angehakt. Orte, die in der eingebauten Ortsliste gefunden wurden, bekommen gleich eine Kartenposition (◎).</p>
  <div class="imp-table">${pending.map((r,i)=>`<div class="imp-row${r.use?'':' off'}" data-i="${i}"><label class="imp-use"><input type="checkbox" data-imp="use"${r.use?' checked':''} aria-label="Übernehmen"></label><input data-imp="name" value="${h(r.name)}" maxlength="120" aria-label="Name"><select data-imp="country" aria-label="Land">${countryOptions(r.country)}</select><input type="date" data-imp="start" value="${h(r.start)}" aria-label="Ankunft"><input type="date" data-imp="end" value="${h(r.end)}" aria-label="Abreise"><span class="imp-pos" title="${r.lat!==null?'Kartenposition gefunden':'Ohne Kartenposition'}">${r.lat!==null?'◎':'–'}</span></div>`).join('')}</div>
  <div class="modal-foot"><button type="button" class="secondary" data-imp-close>Abbrechen</button><button type="button" class="primary" id="imp-go">${ok} ${ok===1?'Station':'Stationen'} hinzufügen</button></div>`;
  if(!d.open)d.showModal();}
function updateCount(){const ok=pending.filter(r=>r.use).length,b=q('#imp-go');if(b)b.textContent=`${ok} ${ok===1?'Station':'Stationen'} hinzufügen`;}
async function open(rows,source){if(!rows.length){notify('Keine Stationen mit Datum gefunden. Jede Station braucht ein Datum, z. B. „12.05.2027 Lissabon“.');return;}pending=await prepare(rows);show(source);}
async function apply(){const C=root.TravelCore,s=state;const picked=pending.filter(r=>r.use);if(!picked.length){notify('Keine Station ausgewählt.');return;}
  const bad=picked.find(r=>!r.country||!C.validDate(r.start));if(bad){notify(`„${bad.name}“: Bitte Land und Ankunftsdatum angeben.`);return;}
  const add=picked.map(r=>C.validate({id:crypto.randomUUID(),name:r.name.trim()||r.city||'Station',country:r.country,city:r.city,kind:r.kind,start:r.start,end:r.end,arrival:r.arrival,departure:r.departure,status:'offen',info:r.info,plan:'',lat:r.lat,lng:r.lng,agent:r.agent||'',agentPhone:r.agentPhone||'',berth:r.berth||''}));
  if(await commit({...s,routeMode:'date',destinations:[...s.destinations,...add]})){dialog().close();notify(`${add.length} ${add.length===1?'Station':'Stationen'} übernommen.`);location.hash='route';}}

async function readFile(file){if(file.size>5*1024*1024)throw Error('Datei zu groß (max. 5 MB).');const text=await file.text();const name=file.name.toLowerCase();
  if(name.endsWith('.ics')||/BEGIN:VCALENDAR/.test(text))return open(parseICS(text),'Kalender');
  if(name.endsWith('.csv')||name.endsWith('.tsv'))return open(parseCSV(text),'Tabelle');
  return open(parseAny(text),'Text');}

/* ---------- Export als Kalenderdatei ---------- */
const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
function fold75(line){const out=[];let cur='';for(const ch of line){if(new TextEncoder().encode(cur+ch).length>74){out.push(cur);cur=' '+ch;}else cur+=ch;}out.push(cur);return out.join('\r\n');}
const dt=s=>s.replace(/-/g,'');
function exportICS(){const s=state,C=root.TravelCore;const names=(()=>{try{return new Intl.DisplayNames([lang()],{type:'region'});}catch{return null;}})();
  const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Reiseatelier//Universal//DE','CALSCALE:GREGORIAN','X-WR-CALNAME:'+esc(s.settings.title||'Reise')];
  const ev=(uid,start,end,allDay,summary,loc,desc,lat,lng)=>{L.push('BEGIN:VEVENT','UID:'+uid+'@reiseatelier','DTSTAMP:'+now);
    if(allDay){L.push('DTSTART;VALUE=DATE:'+dt(start.date),'DTEND;VALUE=DATE:'+dt(addDays(end.date,1)));}else{L.push('DTSTART:'+dt(start.date)+'T'+start.time.replace(':','')+'00','DTEND:'+dt(end.date)+'T'+end.time.replace(':','')+'00');}
    L.push('SUMMARY:'+esc(summary));if(loc)L.push('LOCATION:'+esc(loc));if(desc)L.push('DESCRIPTION:'+esc(desc.slice(0,1500)));if(lat!==null&&lat!==undefined)L.push(`GEO:${lat};${lng}`);L.push('END:VEVENT');};
  let n=0;for(const d of C.route(s)){const loc=[d.city||d.name,names?.of(d.country)||d.country].join(', ');const desc=[d.info,C.aboardLabel(d),d.agent&&((C.cruise?'Hafenagent: ':'Unterkunft: ')+d.agent+(d.agentPhone?' '+d.agentPhone:'')),d.berth,d.plan].filter(Boolean).join('\n\n');
    const end=d.end||d.start;if(d.arrival&&d.departure&&(end>d.start||d.departure>d.arrival))ev('st-'+d.id,{date:d.start,time:d.arrival},{date:end,time:d.departure},false,d.name,loc,desc,d.lat,d.lng);else ev('st-'+d.id,{date:d.start},{date:end},true,d.name,loc,desc,d.lat,d.lng);n++;
    for(const day of d.planning?.days||[])for(const x of day.excursions||[]){const date=day.date||d.start;if(!x.title)continue;if(x.start&&x.end&&x.end>x.start)ev('ex-'+x.id,{date,time:x.start},{date,time:x.end},false,x.title,loc,[x.meeting&&'Treffpunkt: '+x.meeting,x.provider,x.booking&&'Buchung: '+x.booking,x.notes].filter(Boolean).join('\n'),d.lat,d.lng);else ev('ex-'+x.id,{date},{date},true,x.title,loc,x.notes,d.lat,d.lng);n++;}}
  L.push('END:VCALENDAR');return {text:L.map(fold75).join('\r\n')+'\r\n',count:n};}
async function downloadICS(){if(!state.destinations.length){notify('Die Route ist noch leer.');return;}const {text,count}=exportICS();const slug=TravelStore.sync.fileName().replace(/\.json$/,'');
  if(await TravelStore.download(slug+'.ics',text,'text/calendar'))notify(`Kalenderdatei mit ${count} Terminen erstellt. Öffnen fügt sie in den Kalender ein.`);}

document.addEventListener('click',e=>{const t=e.target;
  if(t.closest?.('[data-imp-close]')){dialog().close();return;}
  if(t.closest?.('#imp-go')){apply();return;}
  if(t.closest?.('#import-route-file')){q('#import-route-input').click();return;}
  if(t.closest?.('#import-route-text')){const v=q('#import-text').value;if(!v.trim()){notify('Bitte zuerst einen Reiseverlauf einfügen.');return;}open(parseAny(v),'Text').catch(err=>notify(err.message));return;}
  if(t.closest?.('[data-goto-import]')){setTimeout(()=>q('#import-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),120);return;}
  if(t.closest?.('#export-ics')){downloadICS().catch(err=>notify(err.message));}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='import-route-input'){const f=t.files?.[0];t.value='';if(f)readFile(f).catch(err=>notify('Import fehlgeschlagen: '+err.message));return;}
  const row=t.closest?.('#import-dialog .imp-row');if(row){const r=pending[+row.dataset.i],k=t.dataset.imp;if(k==='use'){r.use=t.checked;row.classList.toggle('off',!t.checked);}else{r[k]=t.value;if(k==='country'&&t.value&&!r.use){r.use=true;row.classList.remove('off');row.querySelector('[data-imp=use]').checked=true;}}updateCount();}});
document.addEventListener('input',e=>{const row=e.target.closest?.('#import-dialog .imp-row');if(row&&e.target.dataset.imp==='name')pending[+row.dataset.i].name=e.target.value;});
/* ---------- Geteilte Inhalte (Android „Teilen an Reiseatelier“) ---------- */
async function takeShared(){if(!/[?&]shared=1/.test(location.search))return;try{history.replaceState(null,'',location.pathname+location.hash);}catch{}
  let p=null;try{const c=await caches.open('rau-share');const key=new URL('./__shared__',location.href).href;const r=await c.match(key);if(r){p=await r.json();await c.delete(key);}}catch{}
  if(!p){notify('Geteilter Inhalt ist nicht angekommen. Bitte noch einmal teilen.');return;}
  if(p.file&&p.file.text){const f={name:p.file.name,size:p.file.text.length,text:async()=>p.file.text};if(/abgleich|reiseatelier-abgleich/.test(p.file.text.slice(0,200))){notify('Das ist eine Abgleich-Datei – bitte unter Einstellungen „Abgleich-Datei laden“ verwenden.');return;}return readFile(f).catch(err=>notify('Import fehlgeschlagen: '+err.message));}
  const text=[p.title,p.text].filter(Boolean).join('\n').trim();const ta=q('#import-text');
  if(text&&parseAny(text).length){if(ta)ta.value=text;return open(parseAny(text),'Geteilt');}
  if(ta)ta.value=[text,p.url].filter(Boolean).join('\n');setTimeout(()=>q('#import-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),200);
  notify(p.url&&!text?'Nur ein Link wurde geteilt. Die App kann Webseiten nicht selbst lesen – bitte auf der Seite den Reiseverlauf markieren und den Text teilen.':'Im geteilten Text wurde kein Datum gefunden. Bitte prüfen und ggf. ergänzen.');}
const waitReady=setInterval(()=>{let r=false;try{r=ready;}catch{}if(r){clearInterval(waitReady);takeShared();}},200);
root.TravelImport={parseAny,extractBooking,open,readFile,parseText,parseCSV,parseICS,exportICS,resolve,loadPlaces,prepare};
})(globalThis);
