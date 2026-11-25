'use strict';
/* Reiseatelier – Sehenswürdigkeiten in der Nähe (für den Tab „Zu Fuß“).
   Quelle: Wikidata (CC0) über den Abfragedienst query.wikidata.org, Fotos von Wikimedia Commons.
   Sortiert nach Bekanntheit (Zahl der Wikipedia-Sprachversionen); Bahnhöfe, Schulen, Straßen, Firmen usw. werden aussortiert.
   Ergebnisse werden 30 Tage auf dem Gerät gespeichert und sind danach auch offline sichtbar. */
(function(root){
/* Kategorien mit den Wikidata-Klassen, die dazugehören */
const CATS=[
  {id:'museum',icon:'🏛',de:'Museen',en:'Museums',q:'Q33506 Q207694 Q17431399 Q2772772 Q588140 Q1007870 Q10624527 Q1970365 Q16735822 Q3329412 Q756102 Q635719'},
  {id:'religion',icon:'⛪',de:'Kirchen & Religion',en:'Churches & religion',q:'Q16970 Q2977 Q44613 Q32815 Q34627 Q44539 Q160742 Q120560 Q163687 Q108325 Q1088552 Q56242215 Q56242063 Q1129743 Q5393308 Q842402 Q697295 Q317557 Q15661340 Q19844914 Q1370598'},
  {id:'history',icon:'🏰',de:'Geschichte & Bauwerke',en:'History & landmarks',q:'Q16560 Q23413 Q57821 Q4989906 Q575759 Q179700 Q483453 Q12518 Q11303 Q12280 Q1081138 Q839954 Q570116 Q2319498 Q174782 Q24354 Q153562 Q1060829 Q5003624 Q1785071 Q91122 Q2065736 Q15243209 Q19757 Q1802963 Q35112127 Q811979 Q41176 Q1307276 Q15078955 Q148837 Q170980 Q860861 Q10855061 Q1497375 Q2111958 Q33837 Q53060 Q1059478 Q44494 Q3305213 Q209939'},
  {id:'nature',icon:'🌳',de:'Natur & Parks',en:'Nature & parks',q:'Q22698 Q167346 Q43501 Q2281788 Q1107656 Q8502 Q40080 Q34038 Q23397 Q207326 Q46169 Q179049 Q473972 Q4421 Q3916863 Q1107656 Q15324 Q131681 Q2385804 Q35509 Q190429'},
  {id:'view',icon:'🔭',de:'Aussicht',en:'Viewpoints',q:'Q6017969 Q1440300 Q2088357 Q1065118 Q11208'}];
const CAT_OF=new Map();for(const c of CATS)for(const id of c.q.split(' '))if(!CAT_OF.has(id))CAT_OF.set(id,c.id);
/* Aussortieren, wenn keine der Klassen oben passt */
const SKIP=new Set(('Q55488 Q3914 Q79007 Q1248784 Q928830 Q34442 Q2175765 Q55491 Q4663385 Q1021645 Q4830453 Q43229 Q16917 Q3918 Q27686 Q11707 Q213441 Q31855 Q515 Q123705 Q2983893 Q4286337 Q15284 Q486972 Q5119 Q6256 Q1549591 Q3957 Q532 Q5084 Q4022 Q1311958 Q7930989 Q12819564 Q1195942 Q22746 Q1093829 Q1637706 Q875538 Q3558970 Q15911314 Q6881511 Q7397 Q891723 Q783794 Q167037 Q1664720 Q11446 Q1365179 Q178561 Q15127012 Q2023000 Q3184121 Q1131296 Q1777138 Q3997 Q18761864 Q1773428 Q1365622 Q1430154 Q14350 Q62447 Q125191 Q7944 Q57831').split(' '));
function query(lat,lng,km,lang){const L=lang==='en'?'en,de,mul':'de,en,mul',wp=lang==='en'?'en':'de';
  return `SELECT ?item ?itemLabel ?itemDescription ?coord ?sl (GROUP_CONCAT(DISTINCT STRAFTER(STR(?c),"entity/");separator=" ") AS ?types) (SAMPLE(?img) AS ?image) (SAMPLE(?a1) AS ?art) (SAMPLE(?a2) AS ?artEn) WHERE {
SERVICE wikibase:around { ?item wdt:P625 ?coord. bd:serviceParam wikibase:center "Point(${lng.toFixed(5)} ${lat.toFixed(5)})"^^geo:wktLiteral; wikibase:radius "${km}". }
?item wikibase:sitelinks ?sl. FILTER(?sl >= 3)
OPTIONAL { ?item wdt:P31 ?c. }
OPTIONAL { ?item wdt:P18 ?img. }
OPTIONAL { ?a1 schema:about ?item; schema:isPartOf <https://${wp}.wikipedia.org/>. }
OPTIONAL { ?a2 schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
SERVICE wikibase:label { bd:serviceParam wikibase:language "${L}". }
} GROUP BY ?item ?itemLabel ?itemDescription ?coord ?sl ORDER BY DESC(?sl) LIMIT 150`;}
const R=6371008.8,rad=Math.PI/180;
function dist(a,b){const s=Math.sin((b[0]-a[0])*rad/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin((b[1]-a[1])*rad/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));}
/* Antwort des Abfragedienstes → Liste {id,name,desc,lat,lng,cat,rank,img,wiki,dist} */
function parse(j,center){const rows=j&&j.results&&j.results.bindings||[],out=[],seen=new Set();
  for(const b of rows){const id=(b.item?.value||'').split('/').pop();if(!id||seen.has(id))continue;
    const m=/Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(b.coord?.value||'');if(!m)continue;const lng=+m[1],lat=+m[2];
    const name=b.itemLabel?.value||'';if(!name||/^Q\d+$/.test(name))continue;
    const types=(b.types?.value||'').split(' ').filter(Boolean);let cat=null;for(const t of types){const c=CAT_OF.get(t);if(c){cat=c;break;}}
    const rank=+(b.sl?.value||0);
    if(!cat){if(types.some(t=>SKIP.has(t))||!types.length)continue;if(rank<12)continue;cat='other';}
    seen.add(id);const img=b.image?.value?b.image.value.replace(/^http:/,'https:')+'?width=360':'';
    out.push({id,name,desc:b.itemDescription?.value||'',lat,lng,cat,rank,img,wiki:b.art?.value||b.artEn?.value||'https://www.wikidata.org/wiki/'+id,dist:center?Math.round(dist(center,[lat,lng])):0});}
  /* Bekanntheit, leicht abgewertet mit der Entfernung */
  const score=s=>s.rank/(1+s.dist/3000);out.sort((a,b)=>score(b)-score(a));return out;}
async function load(lat,lng,km,lang,{force=false}={}){const key=`sights|${lat.toFixed(3)},${lng.toFixed(3)}|${km}|${lang}`,M=root.TravelMaps;
  if(!force&&M){const c=await M.getRoute(key);if(c&&c.list&&Date.now()-c.at<30*864e5)return {list:c.list,at:c.at,cached:true};}
  if(!navigator.onLine)throw Object.assign(Error(lang==='en'?'Sights need an internet connection the first time.':'Sehenswürdigkeiten brauchen beim ersten Laden Internet.'),{offline:true});
  const url='https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query(lat,lng,km,lang));
  let r;try{r=await fetch(url,{headers:{Accept:'application/sparql-results+json'},signal:AbortSignal.timeout?AbortSignal.timeout(40000):undefined});}catch{throw Error(lang==='en'?'Wikidata is unreachable right now.':'Wikidata ist gerade nicht erreichbar.');}
  if(r.status===429)throw Error(lang==='en'?'Too many requests to Wikidata – please try again in a minute.':'Zu viele Anfragen an Wikidata – bitte in einer Minute erneut versuchen.');
  if(!r.ok)throw Error((lang==='en'?'Wikidata error ':'Wikidata-Fehler ')+r.status);
  const list=parse(await r.json(),[lat,lng]).slice(0,80);if(M)await M.putRoute(key,{list,at:Date.now()});return {list,at:Date.now(),cached:false};}
const api={CATS,query,parse,load};root.TravelSights=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
