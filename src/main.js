import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import venues from '../data/venues.json';
import metadata from '../data/metadata.json';
import { rankVenues, walkingEstimate, formatDistance, directionsLink, distanceMeters, nearbyPage, NEARBY_INITIAL, NEARBY_STEP } from './geo.js';

const verified = venues.filter(v => v.verified);
const unverified = venues.filter(v => !v.verified);
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let language = 'en', nearbyShown = NEARBY_INITIAL, origin = null, originMarker, selected = null, line;
const copy = {
 en: {eyebrow:'COPENHAGEN · CHRISTMAS BEER SEASON',title:'A little Christmas.\nA bar around the corner.',intro:'The first Christmas beer deserves a short walk. Find your closest bar on the J-Day list.',locate:'Use my location',or:'or find a place',label:'Address, station or neighbourhood',placeholder:'Try Nørreport Station',search:'Find bars',example:'Start at Nørreport Station ↗',privacy:'Your GPS location stays in your browser. Typed searches go to OpenStreetMap’s Nominatim. Map tiles load from OpenStreetMap.',mapTitle:'Your blue-and-white night, mapped.',closest:'CLOSEST LISTED BAR',before:'Where are you starting?',beforeText:'Share your location or enter a place to find the closest listed bar. No account, no tracking.',directions:'Walking directions ↗',nearby:'Nearby alternatives',more:(n,r)=>`Show ${n} more (${r} left)`,allShown:'All listed bars shown, nearest first.',all:'The full list',unverified:'Not mapped — location unverified',disclaimer:'Listed does not mean open right now. Nisser, hats and free beer are not guaranteed at every bar at every moment.',estimated:'Closest means shortest straight-line distance. Minutes are a rough walking estimate (distance × 1.3), not a routed journey — Google Maps shows the real route.',found:'Starting from',none:'No matching Copenhagen place found. Try a street address or station name.',error:'Search is unavailable just now. Try sharing your location, or try again shortly.',locating:'Finding your location…',denied:'Location was not shared. You can type a place instead.',outside:'This finder covers Copenhagen. You appear to be far away — type a Copenhagen place instead.',searching:'Looking up your starting point…',choose:'Choose your starting point:',pick:'View on map',mapped:'mapped bars',listYear:'venue list',min:'min walk',approx:'About',story:'More than a beer. A very Danish tradition.',storyLead:'Why the blue hats, and what’s actually in the glass?',why:'Why does J-Day exist?',whyText:'The advert came first. The “God jul og godt Tub’år” campaign was so popular that Tuborg created Julebryg in 1981. Thomas Tingstrup formalised J-dag in 1990, inspired by Beaujolais Nouveau and the informal P-dag for Easter beer. In 1999, the release moved from the second Wednesday at 23:59 to the first Friday in November at 20:59.',beer:'Is that molasses?',beerText:'No — the caramel character comes from caramel malt, not melasse. Tuborg Julebryg is a dark, bottom-fermented Vienna-style pilsner at 5.6% ABV, brewed with lager, Munich and caramel malt, with English liquorice added. Think caramel, cereal, liquorice and a hint of blackcurrant.',blend:'The original 1981 recipe blended Tuborg Guld, Fine Festival and KB hvidtøl (taken before sugar was added). Liquorice has been part of it from the start.',footer:'Independent guide, not an official Tuborg website. 18+ · Drink responsibly. Get home safely.',credit:'Venue list: Mig og KBH',facts:'Read the history at lex.dk',product:'Beer details from Carlsberg',status:'6 NOV 2026 · FIRST POUR 20:59',tentative:'Likely location only — this pin is our best match, not confirmed.',coverage:'Mapped locations only (one, Anker, is a likely match, not confirmed). Unverified venues are listed below and excluded from closest-bar results.',sourceTitle:'Where the bar list comes from',sourceText:'Bars are taken from the Mig og KBH J-Day article, refreshed every autumn. Map pins are geocoded from OpenStreetMap; unmatched bars are listed but not ranked.',sourceArticle:'Read the source article ↗',fetched:'List fetched',code:'Source code on GitHub ↗',listFor:'J-Day list'},
 da: {eyebrow:'KØBENHAVN · JULEØLSSÆSON',title:'Lidt jul.\nEn bar rundt om hjørnet.',intro:'Den første juleøl fortjener en kort gåtur. Find din nærmeste bar på J-dagslisten.',locate:'Brug min placering',or:'eller find et sted',label:'Adresse, station eller bydel',placeholder:'Prøv Nørreport Station',search:'Find barer',example:'Start ved Nørreport Station ↗',privacy:'Din GPS-placering bliver i din browser. Adressesøgninger sendes til OpenStreetMaps Nominatim. Kortfliser hentes fra OpenStreetMap.',mapTitle:'Din blå-hvide aften på kortet.',closest:'NÆRMESTE BAR PÅ LISTEN',before:'Hvor starter du?',beforeText:'Del din placering eller skriv et sted for at finde den nærmeste bar på listen. Ingen konto, ingen sporing.',directions:'Rute til fods ↗',nearby:'Andre barer i nærheden',more:(n,r)=>`Vis ${n} mere (${r} tilbage)`,allShown:'Alle barer på listen vises, nærmeste først.',all:'Hele listen',unverified:'Ikke på kortet — placering ikke bekræftet',disclaimer:'På listen betyder ikke åben lige nu. Nisser, huer og gratis øl er ikke garanteret alle steder hele tiden.',estimated:'Nærmeste betyder korteste afstand i luftlinje. Minutterne er et groft skøn til fods (afstand × 1,3), ikke en beregnet rute — Google Maps viser den rigtige rute.',found:'Du starter ved',none:'Intet match i København. Prøv en gadeadresse eller et stationsnavn.',error:'Søgning er ikke tilgængelig lige nu. Del din placering eller prøv igen om lidt.',locating:'Finder din placering…',denied:'Placering blev ikke delt. Du kan skrive et sted i stedet.',outside:'Guiden dækker København. Du ser ud til at være langt væk — skriv et sted i København.',searching:'Finder dit udgangspunkt…',choose:'Vælg dit udgangspunkt:',pick:'Vis på kortet',mapped:'barer på kortet',listYear:'stedliste',min:'min til fods',approx:'Ca.',story:'Mere end en øl. En meget dansk tradition.',storyLead:'Hvorfor de blå huer, og hvad er der egentlig i glasset?',why:'Hvorfor findes J-dag?',whyText:'Reklamen kom først. Kampagnen “God jul og godt Tub’år” blev så populær, at Tuborg skabte Julebryg i 1981. Thomas Tingstrup formaliserede J-dag i 1990, inspireret af Beaujolais Nouveau og den uformelle P-dag for påskebryg. I 1999 flyttede frigivelsen fra anden onsdag kl. 23.59 til første fredag i november kl. 20.59.',beer:'Er det melasse?',beerText:'Nej — karamelsmagen kommer fra karamelmalt, ikke melasse. Tuborg Julebryg er en mørk, undergæret pilsner af wienertypen på 5,6 %, brygget med lager-, münchener- og karamelmalt og tilsat engelsk lakrids. Duft af karamel, korn, lakrids og et strejf af solbær.',blend:'Den oprindelige blanding fra 1981 bestod af Tuborg Guld, Fine Festival og KB hvidtøl (taget fra før tilsætning af sukker). Lakrids har været med fra starten.',footer:'Uafhængig guide — ikke en officiel Tuborg-side. 18+ · Drik ansvarligt. Kom sikkert hjem.',credit:'Stedliste: Mig og KBH',facts:'Historien hos lex.dk',product:'Øldetaljer fra Carlsberg',status:'6. NOV 2026 · FØRSTE SKÆNKNING 20.59',tentative:'Kun sandsynlig placering — bedste match, ikke bekræftet.',coverage:'Kun placeringer på kortet (én, Anker, er et sandsynligt match, ikke bekræftet). Ubekræftede steder står nedenfor og tæller ikke med i nærmeste bar.',sourceTitle:'Hvor barlisten kommer fra',sourceText:'Barerne stammer fra Mig og KBH’s J-dagsartikel og opdateres hvert efterår. Kortnåle er geokodet med OpenStreetMap; barer uden match står på listen men rangeres ikke.',sourceArticle:'Læs kildeartiklen ↗',fetched:'Liste hentet',code:'Kildekode på GitHub ↗',listFor:'J-dagsliste'}
};
const t = () => copy[language];
document.querySelector('#app').innerHTML = `
 <div class="snow" aria-hidden="true"></div><header class="shell header"><a class="brand" href="/"><img src="/hat.svg" alt="" width="38" height="38">J-dag<span>·</span>KBH</a><nav aria-label="Language"><button id="en" class="lang active" lang="en">EN</button><button id="da" class="lang" lang="da">DA</button></nav></header>
 <main class="shell"><section class="hero"><div class="hero-copy"><p class="eyebrow" data-copy="eyebrow"></p><h1 data-copy="title"></h1><p class="intro" data-copy="intro"></p><div class="event-date"><span class="spark">✦</span><span data-copy="status"></span><span class="zone">Copenhagen</span></div></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><img src="/hat.svg" alt=""><span class="star star-a">✦</span><span class="star star-b">✧</span><span class="art-caption">SKÅL, KØBENHAVN</span></div></section>
 <section class="finder" aria-label="Bar finder"><div class="controls"><button id="locate" class="button primary"><span aria-hidden="true">◎</span> <span data-copy="locate"></span></button><span class="or" data-copy="or"></span><form id="search-form"><label for="query" class="sr-only" data-copy="label"></label><div class="search-field"><span aria-hidden="true">⌕</span><input id="query" name="query" autocomplete="off" maxlength="150" required><button class="button search" data-copy="search"></button></div></form></div><div class="search-meta"><button id="example" class="text-button" data-copy="example"></button><a id="coverage" class="text-button" href="#source-title"></a></div><p id="feedback" role="status" aria-live="polite"></p><div id="search-results"></div><p class="privacy" data-copy="privacy"></p></section>
 <section class="map-section"><div class="section-heading"><h2 data-copy="mapTitle"></h2><span class="map-key"><i></i> J-Day ${metadata.year}</span></div><div class="map-grid"><div id="map" role="region" aria-label="Map of listed J-Day bars in Copenhagen"></div><aside id="closest" aria-live="polite"></aside></div><p class="small-note" data-copy="disclaimer"></p></section>
 <section id="nearby-section" hidden><h2 data-copy="nearby"></h2><ol id="nearby" class="nearby-grid" aria-label="Nearby alternatives"></ol><p id="nearby-more-wrap"><button id="nearby-more" class="button" type="button"></button><span id="nearby-done" class="small-note" hidden></span></p><p class="small-note" data-copy="estimated"></p></section>
 <section class="story"><div class="story-heading"><p class="eyebrow">THE STORY BEHIND THE FIRST POUR</p><h2 data-copy="story"></h2><p data-copy="storyLead"></p></div><div class="story-grid"><article><span class="story-number">01 / 1981 → 20:59</span><h3 data-copy="why"></h3><p data-copy="whyText"></p><a href="https://lex.dk/J-dag" target="_blank" rel="noreferrer" data-copy="facts"></a></article><article><span class="story-number">02 / 5.6% · MALT + LIQUORICE</span><h3 data-copy="beer"></h3><p data-copy="beerText"></p><p data-copy="blend"></p><a href="https://www.carlsberggroup.com/products/tuborg/tuborg-julebryg" target="_blank" rel="noreferrer" data-copy="product"></a></article></div></section>
 <details class="full-list"><summary><span data-copy="all"></span> <span>${venues.length}</span></summary><p class="small-note" data-copy="coverage"></p><div id="venue-list"></div></details>
 <section class="source" aria-labelledby="source-title"><h2 id="source-title" data-copy="sourceTitle"></h2><p data-copy="sourceText"></p><dl><div><dt data-copy="listFor"></dt><dd>${metadata.year} · ${escape(metadata.sourceName)}</dd></div><div><dt data-copy="fetched"></dt><dd id="fetched"></dd></div><div><dt>${venues.length}</dt><dd><span id="source-count"></span></dd></div></dl><p class="source-links"><a class="button primary" href="${metadata.sourceUrl}" target="_blank" rel="noreferrer" data-copy="sourceArticle"></a> <a class="button" href="https://github.com/philipposk/j-dag" target="_blank" rel="noreferrer" data-copy="code"></a></p><p class="small-note">${escape(metadata.coordinateSource)}</p></section>
 <footer><p data-copy="footer"></p><p><a href="${metadata.sourceUrl}" target="_blank" rel="noreferrer" data-copy="credit"></a> · ${metadata.year} · <a href="https://6x7.gr">Made by 6×7 ↗</a></p></footer></main>`;

const map = L.map('map', { scrollWheelZoom:false }).setView([55.681,12.565],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
const markers = new Map();
for (const v of verified) {
 const marker = L.circleMarker([v.lat,v.lng], {radius:6,color:'#fff',weight:2,fillColor:'#214f7d',fillOpacity:1}).addTo(map);
 const popup = document.createElement('div'); const title = document.createElement('strong'); title.textContent = v.name;
 const address = document.createElement('p');address.textContent = v.address + (v.tentative ? ' — likely location, unconfirmed' : '');
 const link=document.createElement('a');link.href=directionsLink(v);link.target='_blank';link.rel='noreferrer';link.dataset.venue=v.name;link.className='popup-directions';
 popup.append(title,address,link);marker.bindPopup(popup);marker.on('popupopen',()=>{link.href=directionsLink(v,origin);link.textContent=t().directions;});
 marker.on('click',() => { selected = v; renderClosest(v); });markers.set(v.name,marker);
}
function renderClosest(v) {
 const el = document.querySelector('#closest');
 if (!v) {el.innerHTML=`<span class="pin-art" aria-hidden="true">⌖</span><h3>${t().before}</h3><p>${t().beforeText}</p><span class="aside-stars" aria-hidden="true">✧ · ✦ · ✧</span>`;return;}
 const ranked = origin ? rankVenues(venues,origin) : [];
 const distance = origin ? distanceMeters(origin,v) : null;
 const nearest = ranked[0]?.name === v.name;
 const walking = distance === null ? null : walkingEstimate(distance);
 el.innerHTML = `<p class="eyebrow">${nearest?t().closest:escape(v.district)}</p><h3>${escape(v.name)}</h3><p class="address">${escape(v.address)}</p>${v.tentative?`<p class="aside-note">${t().tentative}</p>`:''}${distance === null ? '' : `<div class="walk"><strong>${Math.max(1,Math.ceil(walking/80))}</strong><span>${t().min}<small>${t().approx} ${formatDistance(walking)}</small></span></div>`}<a class="button primary directions" href="${escape(directionsLink(v,origin))}" target="_blank" rel="noreferrer">${t().directions}</a><p class="aside-note">${t().disclaimer}</p>${distance === null ? '' : `<p class="aside-note">${t().estimated}</p>`}`;
 for (const [name, marker] of markers) marker.setStyle({radius:name===v.name?10:6,fillColor:name===v.name?'#c79143':'#214f7d',weight:name===v.name?3:2});
}
function setOrigin(at,label) {
 if (distanceMeters(at,{lat:55.68,lng:12.56})>35000) {feedback(t().outside,true);return;}
 origin=at;
 if(originMarker) map.removeLayer(originMarker);
 originMarker=L.circleMarker([at.lat,at.lng],{radius:8,color:'#fff',weight:3,fillColor:'#e16952',fillOpacity:1}).addTo(map).bindPopup(escape(label));
 const ranked=rankVenues(venues,at);selected=ranked[0];renderClosest(selected);nearbyShown=NEARBY_INITIAL;renderNearby(ranked);
 if(line) map.removeLayer(line);
 line=L.polyline([[at.lat,at.lng],[selected.lat,selected.lng]],{color:'#c79143',weight:2,dashArray:'5 7'}).addTo(map);
 map.fitBounds(L.latLngBounds([[at.lat,at.lng],[selected.lat,selected.lng]]).pad(1),{maxZoom:17});
 document.querySelector('#nearby-section').hidden=false;
 feedback(`${t().found}: ${label}`);
}
function renderNearby(ranked=origin?rankVenues(venues,origin):[],focusFrom=-1) {
 const {items,remaining,next}=nearbyPage(ranked,nearbyShown);
 const list=document.querySelector('#nearby');
 list.setAttribute('aria-label',t().nearby);
 list.innerHTML=items.map((v,i)=>`<li><button class="nearby-card" data-venue="${escape(v.name)}"><span class="eyebrow">${i+2}. ${formatDistance(walkingEstimate(v.distance))} · ~${Math.max(1,Math.ceil(walkingEstimate(v.distance)/80))} min</span><strong>${escape(v.name)}</strong><span>${escape(v.address)}</span>${v.tentative?`<small class="tentative-tag">${t().tentative}</small>`:''}<span class="nearby-action">${t().pick} ↗</span></button></li>`).join('');
 list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectVenue(b.dataset.venue)));
 const more=document.querySelector('#nearby-more'),done=document.querySelector('#nearby-done');
 more.hidden=remaining===0;more.textContent=remaining?t().more(next,remaining):'';
 done.hidden=remaining!==0||items.length<=NEARBY_INITIAL;done.textContent=t().allShown;
 if(focusFrom>=0)list.querySelectorAll('button')[focusFrom]?.focus();
}
document.querySelector('#nearby-more').addEventListener('click',()=>{const from=nearbyShown;nearbyShown+=NEARBY_STEP;renderNearby(undefined,from);});
function selectVenue(name) { const v=verified.find(v=>v.name===name);if(!v)return;selected=v;renderClosest(v);map.setView([v.lat,v.lng],17);markers.get(name).openPopup(); }
function feedback(message,error=false) {const el=document.querySelector('#feedback');el.textContent=message;el.classList.toggle('error',error);}
let busy=false,lastSearch=0;
async function search(query) {
 if (busy || Date.now()-lastSearch<1200) return;
 busy=true;lastSearch=Date.now();feedback(t().searching);document.querySelector('#search-results').replaceChildren();
 const button=document.querySelector('#search-form button');button.disabled=true;
 try {
  const params = new URLSearchParams({q:query,format:'jsonv2',limit:'4',countrycodes:'dk',viewbox:'12.42,55.76,12.68,55.59',bounded:'1','accept-language':language});
  const response=await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Geocoding unavailable');
  const results=await response.json();
  if(!results.length){feedback(t().none,true);return;}
  if(results.length===1){setOrigin({lat:Number(results[0].lat),lng:Number(results[0].lon)},results[0].display_name);return;}
  feedback(t().choose);
  const target=document.querySelector('#search-results');
  for (const result of results) {const b=document.createElement('button');b.className='result-option';b.textContent=result.display_name;b.addEventListener('click',()=>{target.replaceChildren();setOrigin({lat:Number(result.lat),lng:Number(result.lon)},result.display_name);});target.append(b);}
 }catch{feedback(t().error,true);}finally{busy=false;button.disabled=false;}
}
document.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();const q=document.querySelector('#query').value.trim();if(q)search(q);});
document.querySelector('#example').addEventListener('click',()=>{document.querySelector('#query').value='Nørreport Station';search('Nørreport Station');});
document.querySelector('#locate').addEventListener('click',()=>{if(!navigator.geolocation){feedback(t().denied,true);return;}feedback(t().locating);const b=document.querySelector('#locate');b.disabled=true;navigator.geolocation.getCurrentPosition(p=>{b.disabled=false;setOrigin({lat:p.coords.latitude,lng:p.coords.longitude},language==='da'?'din placering':'your location');},()=>{b.disabled=false;feedback(t().denied,true);},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});});
function renderLanguage() {
 document.documentElement.lang=language;
 document.querySelectorAll('[data-copy]').forEach(el=>{el.textContent=t()[el.dataset.copy];});
 document.querySelector('#query').placeholder=t().placeholder;
 document.querySelector('#fetched').textContent=new Intl.DateTimeFormat(language,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Copenhagen'}).format(new Date(metadata.fetchedAt));
 document.querySelector('#source-count').textContent=`${language==='da'?'barer på listen':'bars listed'} · ${verified.length} ${t().mapped}`;
 document.querySelector('#coverage').textContent=`${verified.length} ${t().mapped} · ${metadata.year} ${t().listYear}`;
 const firstNovember=new Date(Date.UTC(metadata.year,10,1));
 const releaseDay=1+(5-firstNovember.getUTCDay()+7)%7;
 const dateLabel=new Intl.DateTimeFormat(language,{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Copenhagen'}).format(new Date(Date.UTC(metadata.year,10,releaseDay,12)));
 document.querySelector('[data-copy="status"]').textContent=`${dateLabel.toUpperCase()} · ${language==='da'?'FØRSTE SKÆNKNING':'FIRST POUR'} 20:59`;
 const currentYear=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Europe/Copenhagen'}).format(new Date()));
 if(currentYear!==metadata.year)document.querySelector('[data-copy="status"]').textContent=language==='da'?`${metadata.year}-arkiv · årets liste er ikke bekræftet`:`${metadata.year} archive · this year’s list is not confirmed`;
 document.querySelector('#venue-list').innerHTML=[...new Set(venues.map(v=>v.district))].map(d=>`<h3>${escape(d)}</h3><ul>${venues.filter(v=>v.district===d).map(v=>`<li>${v.verified?`<button class="text-button" data-venue="${escape(v.name)}">${escape(v.name)}${v.tentative?' (?)':''} ↗</button>`:`<span>${escape(v.name)} <small>(${t().unverified})</small></span>`}</li>`).join('')}</ul>`).join('');
 document.querySelectorAll('#venue-list [data-venue]').forEach(b=>b.addEventListener('click',()=>{selectVenue(b.dataset.venue);document.querySelector('#map').scrollIntoView({behavior:'smooth',block:'center'});}));
 for(const lang of ['en','da'])document.querySelector(`#${lang}`).classList.toggle('active',lang===language);
 renderClosest(selected);if(origin)renderNearby();
}
for (const lang of ['en','da'])document.querySelector(`#${lang}`).addEventListener('click',()=>{language=lang;renderLanguage();});
renderLanguage();
