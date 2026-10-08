// Ambient motion stays in CSS; short touch effects use the Web Animations API.
let calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let toastTimer;
function oceanScene() {
 return `<div class="ocean-atmosphere" aria-hidden="true"><div class="sunshine"><span>☀</span></div><div class="cloud cloud-one"></div><div class="cloud cloud-two"></div><div class="light-rays"></div><div class="ocean-wave wave-one"></div><div class="ocean-wave wave-two"></div><div class="ocean-wave wave-three"></div>${Array.from({length:12},(_,i)=>`<i class="sea-glint" style="--i:${i};left:${7+i*8}%;top:${36+(i*13)%55}%">✧</i>`).join('')}<div class="gulls">⌁ &nbsp; ⌁ &nbsp; ⌁</div><div class="reef reef-left">${seaweed()}</div><div class="reef reef-right">${seaweed()}</div></div><div class="ocean-toys"><button class="sea-friend swimming-fish" data-ocean="fish" aria-label="Saludar al pez" title="¡Tócame!">${animal('fish')}<span>Fish · Pez</span></button><button class="sea-friend swimming-turtle" data-ocean="turtle" aria-label="Saludar a la tortuga">${animal('turtle')}<span>Turtle · Tortuga</span></button><button class="sea-friend curious-octopus" data-ocean="octopus" aria-label="Saludar al pulpo">${animal('octopus')}<span>Octopus · Pulpo</span></button><button class="treasure-toy" data-ocean="treasure" aria-label="Abrir el cofre de la isla"><span class="chest-light"></span><span class="chest-lid"></span><span class="chest-base">✦</span><small>¡Tócame!</small></button>${Array.from({length:5},(_,i)=>`<button class="touch-bubble" style="--i:${i};left:${12+i*18}%" data-ocean="bubble" aria-label="Reventar burbuja"></button>`).join('')}</div>`;
}
function seaweed(){return '<svg viewBox="0 0 160 140"><g fill="none" stroke-linecap="round"><path d="M65 145Q25 100 56 43M80 145Q115 92 84 14M97 145Q137 130 129 65" stroke="#278c86" stroke-width="15"/><path d="M41 145Q17 128 23 91M110 145Q161 107 149 97" stroke="#5fbaa0" stroke-width="11"/><path d="M74 145Q54 106 79 77" stroke="#a4d290" stroke-width="9"/></g></svg>';}
function announceOcean(message){const toast=document.querySelector('#toast');clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),3000);}
function burst(x,y,count=15){if(calm)return;const colors=['#ffc45b','#3bcbb0','#ff9b8a','#ac95e4','#fff4c9'];for(let i=0;i<count;i++){const particle=document.createElement('span');particle.className='touch-particle';particle.textContent=i%3?'✦':'●';particle.style.color=colors[i%colors.length];particle.style.left=x+'px';particle.style.top=y+'px';document.body.append(particle);const angle=i/count*Math.PI*2, distance=40+Math.random()*85;const animation=particle.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:`translate(${Math.cos(angle)*distance}px,${Math.sin(angle)*distance+35}px) rotate(${i*43}deg) scale(.1)`,opacity:0}],{duration:650+Math.random()*400,easing:'cubic-bezier(.1,.7,.3,1)'});animation.onfinish=()=>particle.remove();}}
function splash(x,y){if(calm)return;const ring=document.createElement('span');ring.className='touch-ring';ring.style.left=x+'px';ring.style.top=y+'px';document.body.append(ring);const animation=ring.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:.9},{transform:'translate(-50%,-50%) scale(2.7)',opacity:0}],{duration:850,easing:'ease-out'});animation.onfinish=()=>ring.remove();}
function refreshMotion(){document.documentElement.dataset.calm=String(calm);const control=document.querySelector('[data-ocean="motion"]');if(control){control.textContent=calm?'▶ Animar océano':'Ⅱ Pausar movimiento';control.setAttribute('aria-pressed',String(calm));}}
function decorateOcean(mount=true){refreshMotion();if(mount){mountMap();document.querySelectorAll('.world>g[transform]:not(.scenic-island)').forEach((el,i)=>{const content=document.createElementNS('http://www.w3.org/2000/svg','g');content.classList.add('island-float');content.style.setProperty('--island',i);while(el.firstChild)content.append(el.firstChild);el.append(content);});}if(screen==='reward'){requestAnimationFrame(()=>burst(innerWidth*.57,innerHeight*.42,42));}if(screen==='game'&&selected===words[question].kind){const answer=document.querySelector('.answer.right');if(answer){const r=answer.getBoundingClientRect();burst(r.x+r.width/2,r.y+50,20);}}}
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-ocean]');
 if(target){const kind=target.dataset.ocean;
  if(kind==='marine'||['fish','turtle','octopus'].includes(kind)){event.stopPropagation();openMarineEncounter(target,kind==='marine'?target.dataset.marineId:kind);return;}
  if(kind==='motion'){calm=!calm;refreshMotion();syncArcheryMotion();SoundWorld.play('tap');return;}
  if(kind==='mascot'){announceOcean('Te quiero con todo mi corazón. Atte. Sunny');}
  else if(kind==='treasure'){target.classList.toggle('opened');announceOcean(target.classList.contains('opened')?'¡Un tesoro de estrellas! Sigue explorando para conocer nuevos amigos.':'El cofre guarda otra sorpresa para tu próxima visita.');}
  else if(kind==='bubble'){if(target.classList.contains('popped'))return;target.classList.add('popped');setTimeout(()=>target.classList.remove('popped'),1800);}
  const rect=target.getBoundingClientRect();burst(rect.x+rect.width/2,rect.y+rect.height/2,kind==='treasure'?32:12);SoundWorld.play(kind==='motion'?'tap':kind);return;
 }
 const panel=event.target.closest('.map-panel');if(panel&&!event.target.closest('button')){splash(event.clientX,event.clientY);SoundWorld.play('splash');}
},true);
document.addEventListener('pointerdown',event=>{const button=event.target.closest('.primary,.category,.nav-item,.collect-card');if(button&&!calm){const rect=button.getBoundingClientRect();splash(event.clientX||rect.x+rect.width/2,event.clientY||rect.y+rect.height/2);}});
document.addEventListener('visibilitychange',()=>{document.documentElement.dataset.hidden=String(document.hidden);});
function goldCoinIcon(){return '<span class="gold-coin-icon" aria-hidden="true"><span>✦</span></span>';}

const MAP_ZOOM_MIN=.40,MAP_ZOOM_DEFAULT=.85,MAP_ZOOM_MAX=.85;
const limitMapZoom=value=>Math.max(MAP_ZOOM_MIN,Math.min(MAP_ZOOM_MAX,value));
const mapCamera = { x: 0, y: 120, zoom: MAP_ZOOM_DEFAULT, initialized: false };
let mapResizeObserver;
let mapVisibilityObserver;
let mapPaintFrame=0;
let suppressMapClick = false;
// Capture before the game and ocean click handlers: releasing a drag is not a tap.
window.addEventListener('click', event => {
 if (suppressMapClick && event.target.closest('.map-viewport')) {
  event.preventDefault(); event.stopImmediatePropagation(); suppressMapClick = false;
 }
}, true);
function unmountMap(){
 closeMarineEncounter(false);
 cancelAnimationFrame(mapPaintFrame);mapPaintFrame=0;
 mapResizeObserver?.disconnect();mapResizeObserver=null;
 mapVisibilityObserver?.disconnect();mapVisibilityObserver=null;suppressMapClick=false;
 const viewport=document.querySelector('.map-viewport');
 viewport?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
}
function mountMap() {
 cancelAnimationFrame(mapPaintFrame);mapPaintFrame=0;
 mapResizeObserver?.disconnect();mapResizeObserver=null;
 mapVisibilityObserver?.disconnect();mapVisibilityObserver=null;
 const panel = document.querySelector('.map-panel');
 if (!panel) return;
 const viewport = document.createElement('div');
 viewport.className = 'map-viewport';
 viewport.tabIndex = 0;
 viewport.setAttribute('role', 'region');
 viewport.setAttribute('aria-label', 'Mapa explorable. Arrastra para moverte. Acerca o aleja con la rueda del mouse o pellizcando con dos dedos. También puedes usar las flechas del teclado.');
 const canvas = document.createElement('div');
 canvas.className = 'map-canvas';
 canvas.style.setProperty('--ocean-margin',OCEAN_MARGIN+'px');
 canvas.style.width=OCEAN_SIZE.width+'px';canvas.style.height=OCEAN_SIZE.height+'px';
 for (const selector of ['.ocean-atmosphere','.ocean-toys']) canvas.append(panel.querySelector(selector));
 marineSpecies.filter(species=>species.motion==='legacy').forEach(species=>{
  const friend=canvas.querySelector(`[data-ocean="${species.id}"]`);
  friend.style.left=`${species.x-species.size/2}px`;friend.style.top=`${species.y-43}px`;
 });
 canvas.querySelector('.ocean-toys').insertAdjacentHTML('beforeend',marineVisitors());
 panel.querySelector('.world')?.remove();
 panel.querySelector('.level-hotspot')?.remove();
 panel.querySelectorAll('.floating-spark').forEach(el=>el.remove());
 canvas.insertAdjacentHTML('beforeend', `${expandedWorld()}${luceroMapGate()}${oceanIslands.map((item,i)=>`<button class="map-node ${i===0?'node-explore':i===1?'node-play':'node-locked'} ${isIslandLocked(item)?'is-locked':''}" style="left:${item.x-26}px;top:${item.y+70*item.scale+24}px" data-island="${i}" data-action="game" aria-label="${isIslandLocked(item)?'Isla bloqueada:':'Jugar en'} ${item.name}">${isIslandLocked(item)?'🔒':i+1}${isIslandLocked(item)?`<small>★ ${item.requiredStars}</small>`:i<2?'<small>¡A jugar!</small>':''}</button>`).join('')}<span class="map-place" style="left:1400px;top:210px">EL JARDÍN DE LAS MAREAS</span><span class="map-place" style="left:1950px;top:1490px">EL REINO DEL SOL</span>`);
 canvas.insertAdjacentHTML('beforeend', oceanIslands.map((item,i)=>`<button class="island-hit" style="left:${item.x-140*item.scale}px;top:${item.y-160*item.scale}px;width:${280*item.scale}px;height:${210*item.scale}px" data-island="${i}" data-action="${i===0?'dictionary':i===1?'game':'preview'}" aria-label="Visitar ${item.name}"></button>`).join(''));
 canvas.querySelector('.node-explore').dataset.island='0';
 canvas.querySelector('.node-play').dataset.island='1';
 canvas.querySelectorAll('.node-locked').forEach((el,i)=>el.dataset.island=String(i+2));
 viewport.append(canvas); panel.prepend(viewport);

 const controls = document.createElement('div'); controls.className = 'map-navigation';
 controls.innerHTML = `<div class="mini-map" aria-hidden="true">${oceanIslands.map(item=>`<i style="left:${(item.x+OCEAN_MARGIN)/(OCEAN_SIZE.width+2*OCEAN_MARGIN)*100}%;top:${(item.y+OCEAN_MARGIN)/(OCEAN_SIZE.height+2*OCEAN_MARGIN)*100}%"></i>`).join('')}<span class="mini-window"></span></div><button type="button" class="recenter-map" aria-label="Volver a la primera isla">⌖ <span>Inicio</span></button>`;
 panel.append(controls);
 const mini=controls.querySelector('.mini-window');
 let viewWidth=viewport.clientWidth,viewHeight=viewport.clientHeight,overview=false;
 const clamp = () => {const zoom=mapCamera.zoom=limitMapZoom(mapCamera.zoom||MAP_ZOOM_DEFAULT);mapCamera.x=Math.max(-OCEAN_MARGIN,Math.min(OCEAN_SIZE.width+OCEAN_MARGIN-viewWidth/zoom,mapCamera.x));mapCamera.y=Math.max(-OCEAN_MARGIN,Math.min(OCEAN_SIZE.height+OCEAN_MARGIN-viewHeight/zoom,mapCamera.y));};
 const paintNow = () => {
  cancelAnimationFrame(mapPaintFrame);mapPaintFrame=0;clamp();
  const zoom=mapCamera.zoom;
  // At a distance, freeze ambient details so seeing more islands does not animate more SVGs.
  // Separate enter/exit thresholds avoid repeatedly restyling the scenery during a pinch.
  const nextOverview=overview?zoom<.60:zoom<=.55;
  if(nextOverview!==overview){overview=nextOverview;canvas.classList.toggle('map-overview',overview);}
  canvas.style.transform=`translate3d(${-mapCamera.x*zoom}px,${-mapCamera.y*zoom}px,0) scale(${zoom})`;
  Object.assign(mini.style,{left:`${(mapCamera.x+OCEAN_MARGIN)/(OCEAN_SIZE.width+2*OCEAN_MARGIN)*100}%`,top:`${(mapCamera.y+OCEAN_MARGIN)/(OCEAN_SIZE.height+2*OCEAN_MARGIN)*100}%`,width:`${Math.min(100,viewWidth/((OCEAN_SIZE.width+2*OCEAN_MARGIN)*zoom)*100)}%`,height:`${Math.min(100,viewHeight/((OCEAN_SIZE.height+2*OCEAN_MARGIN)*zoom)*100)}%`});
 };
 // Keep camera math current for every input, but write to the DOM only once per frame.
 const paint = () => {clamp();if(!mapPaintFrame)mapPaintFrame=requestAnimationFrame(paintNow);};
 // Voyages already run in requestAnimationFrame; paint their camera in the same frame as the boat.
 viewport.addEventListener('voyage-camera',event=>{const {x,y,zoom}=event.detail;mapCamera.zoom=limitMapZoom(zoom);mapCamera.x=x-viewWidth/(2*mapCamera.zoom);mapCamera.y=y-viewHeight/(2*mapCamera.zoom);paintNow();});
 const home = () => {mapCamera.zoom=MAP_ZOOM_DEFAULT;mapCamera.x=0;mapCamera.y=0;paint();};
 viewport.addEventListener('visit-landmark',event=>{const item=oceanIslands.find(island=>island.type===event.detail);if(!item)return;mapCamera.x=item.x-viewport.clientWidth*.5/(mapCamera.zoom||1);mapCamera.y=item.y-viewport.clientHeight*.48/(mapCamera.zoom||1);paint();announceOcean(`${item.name} · ${isIslandLocked(item)?'Esta isla está bloqueada.':'¡Tu aventura te espera!'}`);});
 controls.querySelector('button').addEventListener('click',event=>{event.stopPropagation();home();});
 if(!mapCamera.initialized){mapCamera.initialized=true;home();}paintNow();
 let drag=null,pinch=null;
 const pointers=new Map();
 const canNavigate=()=>screen==='map'&&!islandTravelActive&&!document.querySelector('.marine-dialog[open]');
 const zoomLimit=limitMapZoom;
 const localPoint=(x,y)=>{const box=viewport.getBoundingClientRect();return {x:x-box.left,y:y-box.top};};
 const zoomAt=(zoom,point,world)=>{
  mapCamera.zoom=zoomLimit(zoom);mapCamera.x=world.x-point.x/mapCamera.zoom;mapCamera.y=world.y-point.y/mapCamera.zoom;paint();
 };
 viewport.addEventListener('wheel',event=>{
  if(!canNavigate()||pointers.size)return;
  event.preventDefault();
  const point=localPoint(event.clientX,event.clientY),zoom=mapCamera.zoom||1;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientHeight:1);
  zoomAt(zoom*Math.exp(-Math.max(-500,Math.min(500,delta))*.002),point,{x:mapCamera.x+point.x/zoom,y:mapCamera.y+point.y/zoom});
 },{passive:false});
 const startPinch=()=>{
  const [a,b]=[...pointers.values()],point=localPoint((a.x+b.x)/2,(a.y+b.y)/2),zoom=mapCamera.zoom||1;
  pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,world:{x:mapCamera.x+point.x/zoom,y:mapCamera.y+point.y/zoom}};
  drag=null;suppressMapClick=true;viewport.classList.add('dragging');
  for(const id of pointers.keys())viewport.setPointerCapture(id);
 };
 viewport.addEventListener('pointerdown',event=>{
  if(event.button!==0||!canNavigate()||pointers.size>=2)return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2){event.preventDefault();startPinch();return;}
  suppressMapClick=false;
  drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:mapCamera.x,y:mapCamera.y,zoom:mapCamera.zoom||1,moved:false};
 });
 viewport.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId)||!canNavigate())return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pinch){
   event.preventDefault();const [a,b]=[...pointers.values()];
   zoomAt(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance,localPoint((a.x+b.x)/2,(a.y+b.y)/2),pinch.world);return;
  }
  if(!drag||drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
  if(!drag.moved&&Math.hypot(dx,dy)<8)return;
  if(!drag.moved){drag.moved=true;viewport.setPointerCapture(event.pointerId);viewport.classList.add('dragging');}
  event.preventDefault();mapCamera.x=drag.x-dx/drag.zoom;mapCamera.y=drag.y-dy/drag.zoom;paint();
 });
 const end=event=>{
  if(!pointers.has(event.pointerId))return;
  suppressMapClick=Boolean(pinch||drag?.moved||suppressMapClick);
  pointers.delete(event.pointerId);pinch=null;drag=null;
  if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
  if(pointers.size){const [id,point]=[...pointers][0];drag={id,startX:point.x,startY:point.y,x:mapCamera.x,y:mapCamera.y,zoom:mapCamera.zoom||1,moved:true};}
  else viewport.classList.remove('dragging');
 };
 viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
 viewport.addEventListener('lostpointercapture',event=>{if(event.target===viewport)end(event);});
 viewport.addEventListener('pointerleave',event=>{if(!viewport.hasPointerCapture(event.pointerId))end(event);});
 viewport.addEventListener('keydown',event=>{if(event.target!==viewport)return;const offsets={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,-100],ArrowDown:[0,100]};if(event.key==='Home'){event.preventDefault();home();}else if(offsets[event.key]){event.preventDefault();mapCamera.x+=offsets[event.key][0];mapCamera.y+=offsets[event.key][1];paint();}});
 mapResizeObserver=new ResizeObserver(()=>{viewWidth=viewport.clientWidth;viewHeight=viewport.clientHeight;paint();});mapResizeObserver.observe(viewport);
 // Keep every illustration; animate nearby scenery only, resuming before it enters view.
 mapVisibilityObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)entry.target.classList.toggle('map-sleeping',!entry.isIntersecting);
 },{root:viewport,rootMargin:'220px'});
 canvas.querySelectorAll('.scenic-island,.extra-decor > *,.ocean-toys > button,.marine-home').forEach(el=>mapVisibilityObserver.observe(el));
}

// Stable IDs are part of the player's save. Artwork and positions never encode outcomes.
const MARINE_SAVE_KEY='ximena-marine-encounters-v1';
const MARINE_COOLDOWN_MS=3*24*60*60*1000;
const MARINE_REWARD_VERSION=3;
const MARINE_REWARD_COUNTS=[{effect:500,count:1},{effect:10,count:11},{effect:-20,count:14},{effect:-250,count:2}];
const MARINE_OCEAN_ELEMENTS=['sailboat','seaweed','coral','reef','seashell'];
const marineSpecies=[
 ['hammerhead','Tiburón martillo','Hammerhead shark','shark','#83b5b9',1600,250,160],
 ['whale-shark','Tiburón ballena','Whale shark','shark','#739eae',2650,800,176],
 ['tiger-shark','Tiburón tigre','Tiger shark','shark','#92aaa2',3900,300,154],
 ['reef-shark','Tiburón de arrecife','Reef shark','shark','#9bbfbf',4950,900,145],
 ['clownfish','Pez payaso','Clownfish','fish','#edb079',500,1700,103],
 ['blue-tang','Pez cirujano azul','Blue tang','fish','#85aecd',1700,1550,111],
 ['butterflyfish','Pez mariposa','Butterflyfish','fish','#e9ce8c',2800,1650,106],
 ['pufferfish','Pez globo','Pufferfish','fish','#b4c89a',3900,2000,110],
 ['angelfish','Pez ángel','Angelfish','fish','#c7b1d4',4800,1780,114],
 ['flying-fish','Pez volador','Flying fish','fish','#a4d5cf',6150,1950,133],
 ['crab','Cangrejo','Crab','crawler','#dfa78c',400,2750,104],
 ['lobster','Langosta','Lobster','crawler','#cf9b8e',1400,3100,120],
 ['shrimp','Camarón','Shrimp','crawler','#ecb9a5',2600,2550,107],
 ['hermit-crab','Cangrejo ermitaño','Hermit crab','crawler','#c5aa94',3700,2950,115],
 ['manta','Mantarraya','Manta ray','ray','#8cb8bf',4850,2750,153],
 ['dolphin','Delfín','Dolphin','swimmer','#8ab8c7',6150,4150,147],
 ['jellyfish','Medusa','Jellyfish','drifter','#c7b4d9',700,3950,112],
 ['seahorse','Caballito de mar','Seahorse','drifter','#e0bd86',1700,4050,94],
 ['starfish','Estrella de mar','Starfish','crawler','#e2b093',2850,3500,95],
 ['cuttlefish','Sepia','Cuttlefish','swimmer','#b9b1cd',4100,4030,119],
 ['sailboat','Barco velero','Sailboat','boat','#d9b58c',6220,3060,150],
 ['seaweed','Algas marinas','Seaweed','anchored','#90bda0',3550,1150,120],
 ['coral','Coral','Coral','anchored','#dda69b',3250,4270,126],
 ['reef','Arrecife','Reef','anchored','#b8adca',1150,2260,152],
 ['seashell','Concha marina','Seashell','anchored','#e3baa5',6280,1155,94],
 ['fish','Pez','Fish','legacy',null,350,820,100],
 ['turtle','Tortuga marina','Sea turtle','legacy',null,5320,3700,100],
 ['octopus','Pulpo','Octopus','legacy',null,6150,300,100]
].map(([id,es,en,motion,color,x,y,size])=>({id,es,en,motion,color,x,y,size}));

function marineArt(species){
 if(species.motion==='legacy')return animal(species.id);
 const {id,color:c}=species,eye=(x,y)=>`<circle cx="${x}" cy="${y}" r="3" fill="#355e68"/><circle cx="${x+.8}" cy="${y-.8}" r=".9" fill="#fffbe9"/>`;
 let art='';
 if(species.motion==='shark'||id==='dolphin'){
  art=`<g class="visitor-tail"><path d="M-44 0Q-63-7-73-29l4 27-9 25Q-54 16-44 0" fill="${c}"/></g><path d="M-48 1Q-21-29 26-18Q49-14 64-2Q73 5 55 13Q0 31-48 1Z" fill="${c}"/><path d="M-32 7Q13 17 60 4Q45 28 2 21Z" fill="#e0ecda"/><path d="M-14-18Q-7-42 3-43l6 25M-1 15l19 21-3-23" fill="${c}"/><path d="M-28-10Q-3-24 23-17" fill="none" stroke="#d7ebe0" stroke-width="2" stroke-linecap="round"/>${id==='hammerhead'?`<path d="M44-9Q34-30 44-32h12q7 1 4 9l-1 29q5 17-5 18H42q-8-3 4-17Z" fill="${c}"/>${eye(51,-25)}`:eye(48,-7)}<path d="m48 9 9-2" stroke="#557e84" stroke-width="1.6" stroke-linecap="round"/>`;
  if(id==='tiger-shark')art+='<path d="m-28-10 6 14m8-20 6 16m9-19 4 17m10-15 2 12" fill="none" stroke="#678c86" stroke-width="4" opacity=".65"/>';
  if(id==='whale-shark')art+=Array.from({length:15},(_,i)=>`<circle cx="${-26+i%5*13}" cy="${-9+Math.floor(i/5)*8}" r="1.9" fill="#daede2"/>`).join('');
  if(id==='reef-shark')art+='<path d="m-7-31 10-12 3 11" fill="#ecf2e4"/>';
  if(id==='dolphin')art+=`<path d="M51-5q34-4 28 4L57 8Z" fill="${c}"/>`;
 }else if(species.motion==='fish'){
  art=`<g class="visitor-tail"><path d="m-31 0-29-24 4 24-4 23Z" fill="${id==='blue-tang'?'#ecd38c':c}"/></g><path d="m-12-19 16-20 13 20m-22 39 16 18 7-21" fill="${c}"/><ellipse rx="39" ry="25" fill="${c}"/><path d="M-26 11Q5 33 32 8Q22 28-3 25Z" fill="#fff2d0" opacity=".6"/>`;
  if(id==='clownfish')art+='<path d="M-22-18q9 16 1 36M1-24q-7 24 0 48m23-42q-7 17 0 34" stroke="#fff5dd" stroke-width="8" fill="none"/>';
  if(id==='blue-tang')art+='<path d="M-25-9Q-2-24 19-14L8 5-27 9l16-12Z" fill="#607c9c"/>';
  if(id==='butterflyfish')art+='<path d="M-17-20q8 20-1 40M-2-24q9 24 0 48m17-45q-9 20 0 42" fill="none" stroke="#fcf0c9" stroke-width="5"/><path d="m27-14-4 30" stroke="#788b97" stroke-width="5"/>';
  if(id==='angelfish')art+='<path d="m-12-21-4 42M5-24 0 47 23 8 9-41l-4 17" fill="none" stroke="#fcf0c9" stroke-width="5"/><path d="m26-16-4 34" stroke="#788b97" stroke-width="6"/>';
  if(id==='pufferfish')art=`<g class="visitor-tail"><path d="m-29 0-27-18 3 18-3 18Z" fill="${c}"/></g><circle r="31" fill="${c}"/><path d="M-24 14q24 20 48-2" fill="#e9edcf"/>${Array.from({length:8},(_,i)=>`<path d="m${-27+i%4*15} ${-24+Math.floor(i/4)*16}-3-6" stroke="#8ca47e" stroke-width="2" stroke-linecap="round"/>`).join('')}`;
  if(id==='flying-fish')art+='<path class="visitor-fin" d="M-7 2Q-45-47-22-34L22-6Z" fill="#d6eee1" stroke="#7eafb1" stroke-width="1.5"/>';
  art+=`<path class="visitor-fin" d="m0 2-13 9 17 3Z" fill="#ffffff55"/>${eye(26,-6)}<path d="m30 8 6-2" stroke="#7c8b7b" stroke-width="1.5"/>`;
 }else if(['crab','lobster','hermit-crab','shrimp'].includes(id)){
  const legs='<g class="visitor-legs" stroke="#b78979" stroke-width="3" fill="none" stroke-linecap="round"><path d="m-15 10-20 6-7 9m29-8-13 11-1 6m40-24 20 6 7 9m-29-8 13 11 1 6"/></g>';
  art=legs+`<path d="m-17-1-18-15m52 15 18-15" stroke="${c}" stroke-width="7" stroke-linecap="round"/><g class="visitor-claws" fill="${c}"><path d="M-35-9q-22 0-17-22l11 9 9-13q16 16-3 26M35-9q22 0 17-22l-11 9-9-13q-16 16 3 26"/></g><ellipse rx="26" ry="18" fill="${c}"/><path d="M-17-7q17-13 33 0" fill="none" stroke="#f5d5b6" stroke-width="3"/><path d="M-10-13v-9m20 9v-9" stroke="#b78979" stroke-width="3"/>${eye(-10,-22)}${eye(10,-22)}`;
  if(id==='lobster')art=`<path d="M-16 7q-7 18 6 34l-12 7 22-2 22 2-12-7q13-16 6-34" fill="${c}"/><path d="M-12 23h24m-21 9h18" stroke="#ae7d76" stroke-width="2"/>`+art;
  if(id==='hermit-crab')art=`<path d="M-43 16q-24-53 14-57 36 2 24 42Z" fill="#d1bd9d"/><path d="M-31 10q-24-29 0-37 21-1 16 18-5 12-14 2" fill="none" stroke="#aa9684" stroke-width="4"/>`+`<g transform="translate(17 8) scale(.7)">${art}</g>`;
  if(id==='shrimp')art=legs+`<path d="M27-9Q-6-39-36-10q-19 29 16 41l17-13Q-36 9-14-1L29 8Z" fill="${c}"/><path class="visitor-tail" d="m-20 28-21 9 1-11-10-6 21-6" fill="#dca28e"/><path d="m-26-9 6 17m-18-2 11 11M24-10Q34-35 58-25M26-8Q47-27 68-13" fill="none" stroke="#b98c7b" stroke-width="2"/>${eye(25,-8)}`;
 }else if(id==='manta'){
  art=`<path d="M-16 9q-24 26-43 28" fill="none" stroke="#699aa5" stroke-width="3"/><path class="visitor-wings" d="M7-11Q-10-56-29-45q9 29-14 43 19 4 26 13Q-2 25 9 46q13-17 12-31L44 0Z" fill="${c}"/><path d="M-26 0Q5-21 39-8l10-9-1 18 1 18-10-9Q6 25-26 0Z" fill="${c}"/><path d="M-13 7q24 15 45 1" fill="#cbe3d8"/>${eye(32,-7)}`;
 }else if(id==='jellyfish'){
  art=`<g class="visitor-tentacles" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"><path d="M-27 1q-11 18 0 28t-3 21M-9 5q12 15 0 27t2 18M11 3q-12 19 0 34m15-35q13 18 0 34"/></g><g class="visitor-bell"><path d="M-39 3Q-40-41 0-42T39 3Q30 13 21 4 10 15 0 5-12 14-21 4-31 13-39 3Z" fill="${c}"/><path d="M-26-12q0-17 17-21" stroke="#eee4ef" stroke-width="5" fill="none" stroke-linecap="round"/>${eye(-12,-9)}${eye(12,-9)}</g>`;
 }else if(id==='seahorse'){
  art=`<path class="visitor-fin" d="M-9-4-28-19l1 30 20-4" fill="#e8d4a9"/><path d="M-9-29Q-8-50 12-43q17 5 9 19l19 5-2 10-21-4Q4-1 10 15q15 31-9 33-20 0-14-16 5-10 13-3-12 1-7 9 16 8 9-11Q-28 5-9-29Z" fill="${c}"/><path d="m-10-26-10-4 9-6-6-8 14 1m-4 44 12 4M-4 13l10 1" stroke="#bd9e73" stroke-width="2" fill="none"/>${eye(13,-31)}`;
 }else if(id==='starfish'){
  art=`<path d="M0-42Q5-44 13-14l31 1Q53-9 23 9l8 29q0 10-29-13l-29 15q-10 2 2-29L-47-8q-8-9 32-7Z" fill="${c}"/><path d="M0-29 1-2l-30-5M1-2l24 29M1-2l-19 29M1-2l31-7" fill="none" stroke="#f7d6ad" stroke-width="3" stroke-linecap="round"/>${eye(-8,-3)}${eye(8,-3)}`;
 }else if(id==='sailboat'){
  art=`<path class="visitor-ripple" d="M-66 39q15-5 31 0t31 0 31 0 31 0" fill="none" stroke="#d9ece0" stroke-width="4" stroke-linecap="round"/><path d="M-5 19v-64" stroke="#af947d" stroke-width="4" stroke-linecap="round"/><g class="visitor-sail"><path d="M-11-40Q-30-17-51 9h40Z" fill="#fff1d0"/><path d="M2-39Q14-15 39 8H2Z" fill="#9dc7c0"/><path d="M3-24 24 3H3Z" fill="#beddd1"/></g><path d="M-6-46q14-9 25 0l-12 8-13-3Z" fill="#dfa79b"/><path d="M-57 16H56Q42 41-35 35Z" fill="${c}"/><path d="M-50 18H49" stroke="#f6dcb6" stroke-width="5" stroke-linecap="round"/>${eye(-10,27)}${eye(10,27)}<path d="M-3 31q3 3 6 0" fill="none" stroke="#a17c6c" stroke-width="1.5" stroke-linecap="round"/>`;
 }else if(id==='seaweed'){
  art=`<ellipse cy="32" rx="39" ry="11" fill="#c2cbb2"/><ellipse cx="-19" cy="29" rx="11" ry="5" fill="#dce1c7"/><g class="visitor-fronds"><path d="M-19 31Q-45 4-29-30q23 8 7 31M1 32Q-14 3 0-47q20 26 7 52M21 31q32-33 14-54Q11-6 24 7" fill="${c}"/><path d="M0 30Q-9 5 1-33m-20 64Q-33 5-29-18m49 49q20-25 16-39" fill="none" stroke="#d0e2b7" stroke-width="2.5" stroke-linecap="round"/><path d="M-1 8Q-24 3-20-10 1-14-1 8M8-5Q31-14 22-31 7-27 8-5" fill="#a8ccab"/>${eye(-5,17)}${eye(8,17)}</g>`;
 }else if(id==='coral'){
  art=`<ellipse cy="33" rx="41" ry="10" fill="#c9cbb1"/><g class="visitor-fronds"><g fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M0 30V-32M0 14-26-4v-23M-26-4-42-13v-14M0-4 27-16v-24M27-16l18-5v-14"/></g><g fill="none" stroke="#f4c8b5" stroke-width="3" stroke-linecap="round"><path d="M-3 26V-26M-25-8v-14m52 1v-13M-38-17v-8m80 0v-6"/></g>${eye(-7,17)}${eye(7,17)}</g>`;
 }else if(id==='reef'){
  art=`<path d="M-65 34q0-21 24-19-3-38 31-36 27-8 33 23 34-10 41 32Z" fill="${c}"/><path d="M-28 13q-13-13 2-20 18-8 17 8-19-2-11 9 15 8 21-1 8-17 15-2M-2-12q12-4 16 8m-59 26q15-9 21 4m29-5q18-9 25 4" fill="none" stroke="#ded0de" stroke-width="3" stroke-linecap="round"/><g class="visitor-fronds" fill="none" stroke="#dfa99b" stroke-width="7" stroke-linecap="round"><path d="M35 27v-50M35 9 22-5v-12M35-5l15-9v-12"/></g><g fill="#91bab1"><rect x="-55" y="-2" width="13" height="30" rx="6"/><rect x="-42" y="7" width="12" height="24" rx="6"/></g><ellipse cx="-48.5" cy="1" rx="4" ry="2" fill="#699a98"/><ellipse cx="-36" cy="10" rx="3.5" ry="2" fill="#699a98"/><path class="visitor-ripple" d="M-61 37q17 4 34 0t34 0 34 0 23 0" fill="none" stroke="#daecdc" stroke-width="3" stroke-linecap="round"/>${eye(-8,18)}${eye(8,18)}`;
 }else if(id==='seashell'){
  art=`<path d="M-42 24Q0 47 42 24L17 11h-34Z" fill="#cda498"/><g class="visitor-shell"><path d="M-40 18Q-61-2-41-14q-7-21 13-24 7-20 25-8 18-14 29 4 24-1 22 20 21 12 1 34L15 31h-29Z" fill="${c}"/><path d="M-32-13-8 25M-23-30-3 24M-1-36 2 23M20-30 8 25M36-15 13 25" fill="none" stroke="#f5d9be" stroke-width="4" stroke-linecap="round"/></g><ellipse cy="30" rx="16" ry="10" fill="#f9e9ce"/>${eye(-6,28)}${eye(6,28)}`;
 }else{
  art=`<path class="visitor-wings" d="M-43 0Q-30-41 19-20l22 20-22 20Q-30 41-43 0Z" fill="#d5c9de"/><ellipse cx="-9" rx="36" ry="21" fill="${c}"/><path class="visitor-tentacles" d="M21-7q25-19 37-4M22 0q22 10 40-2M21 7q25 24 34 11" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M-29-10q13-12 31-2" fill="none" stroke="#eee1e7" stroke-width="3"/>${eye(23,-8)}`;
 }
 return `<svg class="marine-art" viewBox="-85 -58 170 116" aria-hidden="true"><ellipse cy="38" rx="49" ry="7" fill="#307e8018"/>${art}</svg>`;
}

function marineVisitors(){
 // Keep clear water between whole motion envelopes, including the original friends.
 const homes=marineSpecies.filter(s=>s.motion==='legacy').map(s=>({x:s.x,y:s.y,radius:s.size/2+115}));
 return marineSpecies.filter(s=>s.motion!=='legacy').map((species,i)=>{
  const radius=species.size/2+45;
  let {x,y}=species;
  for(let attempt=0;attempt<60;attempt++){
   if(x>radius&&x<OCEAN_SIZE.width-radius&&y>radius&&y<OCEAN_SIZE.height-radius&&homes.every(home=>Math.hypot(x-home.x,y-home.y)>=600+radius+home.radius)&&oceanIslands.every(island=>Math.abs(x-island.x)>island.scale*160+species.size/2+55||Math.abs(y-island.y)>island.scale*170+species.size/2+35))break;
   x=species.x+(attempt%2?1:-1)*(90+Math.floor(attempt/2)*65);y=species.y+80+attempt*12;
  }
  homes.push({x,y,radius});
  return `<div class="marine-home" style="left:${x}px;top:${y}px;--visitor-size:${species.size}px;--visitor-duration:${species.motion==='crawler'?24+i%3*3:19+i%5*3}s;--visitor-delay:${-i*2.7}s"><button type="button" class="marine-visitor marine-${species.motion}" data-ocean="marine" data-marine-id="${species.id}" aria-label="Saludar: ${species.es} · ${species.en}"><span class="marine-heading">${marineArt(species)}</span></button></div>`;
 }).join('');
}

function readMarineSave(){
 const raw=localStorage.getItem(MARINE_SAVE_KEY);
 const state=raw?JSON.parse(raw):{animals:{}};
 if(!state||!state.animals||typeof state.animals!=='object'||Array.isArray(state.animals))throw new Error('Invalid marine save');
 for(const entry of Object.values(state.animals))if(!entry||!MARINE_REWARD_COUNTS.some(reward=>reward.effect===entry.effect)||typeof entry.met!=='boolean'||(entry.lastMetAt!==undefined&&(!Number.isSafeInteger(entry.lastMetAt)||entry.lastMetAt<0))||(entry.lastEffect!==undefined&&!MARINE_REWARD_COUNTS.some(reward=>reward.effect===entry.lastEffect)))throw new Error('Invalid encounter');
 return state;
}
function migrateMarineCooldowns(state,now){
 let changed=false;
 // Preserve dates and greetings when bringing an older save into shared rounds.
 for(const entry of Object.values(state.animals))if(entry.met&&entry.lastMetAt===undefined){entry.lastMetAt=now;changed=true;}
 if(state.pending&&state.pending.at===undefined){state.pending.at=now;changed=true;}
 return changed;
}
function initializeMarineCooldowns(){
 return withMarineLock(()=>{
  const state=readMarineSave(),hadPending=Boolean(state.pending);prepareMarineRound(state,Date.now());
  if(hadPending){coinBalance=readCoinBalance();syncCoinHud();}
 });
}
// Opening initialization is coordinated with the inactivity check in inactivity.js.
function shuffleMarine(values){
 const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
function drawMarineEffects(previous={}){
 const rewards=MARINE_REWARD_COUNTS.flatMap(({effect,count})=>Array(count).fill(effect));
 if(rewards.length!==marineSpecies.length)throw new Error('Invalid marine reward counts');
 const slots=shuffleMarine(rewards.map((_,index)=>index)),owners=Array(rewards.length).fill(null);
 // Match animals to shuffled reward slots while excluding their previous amount.
 // No amount may occupy more than half the slots if ALL encounters must change.
 const assign=(id,seen)=>{
  for(const slot of slots){
   if(seen.has(slot)||previous[id]?.effect===rewards[slot])continue;
   seen.add(slot);
   if(owners[slot]===null||assign(owners[slot],seen)){owners[slot]=id;return true;}
  }
  return false;
 };
 for(const species of shuffleMarine(marineSpecies))if(!assign(species.id,new Set()))throw new Error('Cannot change every marine reward');
 return Object.fromEntries(owners.map((id,slot)=>[id,rewards[slot]]));
}
function prepareMarineRound(state,now){
 let changed=migrateMarineCooldowns(state,now);
 // Complete a previous transaction with its ORIGINAL amount before any shuffle.
 settleMarineReceipt(state);
 // Extend the existing 23-member round without changing its deadline or outcomes.
 // Only the five new elements receive the extra two gifts and three small losses.
 if(state.rewardVersion===2){
  const previousSpecies=marineSpecies.filter(s=>!MARINE_OCEAN_ELEMENTS.includes(s.id));
  const oldCounts=[{effect:500,count:1},{effect:10,count:9},{effect:-20,count:11},{effect:-250,count:2}];
  if(!Number.isSafeInteger(state.roundStartedAt)||state.roundStartedAt<0||!previousSpecies.every(s=>state.animals[s.id])||MARINE_OCEAN_ELEMENTS.some(id=>state.animals[id])||!oldCounts.every(({effect,count})=>previousSpecies.filter(s=>state.animals[s.id].effect===effect).length===count))throw new Error('Invalid previous marine round');
  const extraEffects=shuffleMarine([10,10,-20,-20,-20]);
  MARINE_OCEAN_ELEMENTS.forEach((id,index)=>{state.animals[id]={effect:extraEffects[index],met:false};});
  state.rewardVersion=MARINE_REWARD_VERSION;changed=true;
 }
 const upgrading=state.rewardVersion!==MARINE_REWARD_VERSION;
 if(!upgrading&&(!Number.isSafeInteger(state.roundStartedAt)||state.roundStartedAt<0||!marineSpecies.every(s=>state.animals[s.id])||!MARINE_REWARD_COUNTS.every(({effect,count})=>marineSpecies.filter(s=>state.animals[s.id].effect===effect).length===count)))throw new Error('Invalid marine round');
 if(upgrading||now-state.roundStartedAt>=MARINE_COOLDOWN_MS){
  const effects=drawMarineEffects(upgrading?{}:state.animals);
  state.roundStartedAt=upgrading?now:state.roundStartedAt+Math.floor((now-state.roundStartedAt)/MARINE_COOLDOWN_MS)*MARINE_COOLDOWN_MS;
  state.rewardVersion=MARINE_REWARD_VERSION;
  for(const species of marineSpecies){
   const previous=state.animals[species.id];
   state.animals[species.id]={...previous,effect:effects[species.id],met:Boolean(upgrading&&previous?.met&&now-previous.lastMetAt<MARINE_COOLDOWN_MS)};
   if(previous?.met)state.animals[species.id].lastEffect=previous.lastEffect??previous.effect;
  }
  changed=true;
 }
 if(changed)localStorage.setItem(MARINE_SAVE_KEY,JSON.stringify(state));
}
// A saved receipt precedes the balance write. Pending receipts can be finished safely
// after an interrupted write, without repeating an effect within its cooldown.
function settleMarineReceipt(state){
 const receipt=state.pending;if(!receipt)return;
 if(!state.animals[receipt.id]||![receipt.before,receipt.after,receipt.at].every(n=>Number.isSafeInteger(n)&&n>=0))throw new Error('Invalid receipt');
 if(receipt.effect!==undefined&&!MARINE_REWARD_COUNTS.some(reward=>reward.effect===receipt.effect))throw new Error('Invalid receipt effect');
 if(receipt.roundStartedAt!==undefined&&receipt.roundStartedAt!==state.roundStartedAt)throw new Error('Invalid receipt round');
 const current=Number(localStorage.getItem(COIN_STORAGE_KEY)||0);
 if(current===receipt.before)localStorage.setItem(COIN_STORAGE_KEY,String(receipt.after));
 if(receipt.after>receipt.before&&!recordActivityReward({coins:receipt.after-receipt.before,at:receipt.at,source:`marine:${receipt.id}`,id:`${receipt.roundStartedAt??0}:${receipt.id}:${receipt.at}`}))throw new Error('Reward date not saved');
 // A different balance belongs to a later game or purchase; never overwrite it.
 state.animals[receipt.id].met=true;state.animals[receipt.id].lastMetAt=receipt.at;state.animals[receipt.id].lastEffect=receipt.effect??state.animals[receipt.id].effect;delete state.pending;
 localStorage.setItem(MARINE_SAVE_KEY,JSON.stringify(state));
}
function withMarineLock(action){
 if(navigator.locks?.request)return navigator.locks.request('ximena-marine-encounters',action);
 // HTTP on a local network may lack Web Locks. IndexedDB serializes tabs there too.
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('ximena-marine-mutex',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('locks');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;let result,error;
   const transaction=db.transaction('locks','readwrite');
   transaction.objectStore('locks').get('encounter').onsuccess=()=>{try{result=action();}catch(reason){error=reason;}};
   transaction.oncomplete=()=>{db.close();if(error)reject(error);else resolve(result);};
   transaction.onabort=()=>{db.close();reject(transaction.error||new Error('Encounter lock unavailable'));};
  };
 });
}
function claimMarineEncounter(id){
 return withMarineLock(()=>{
  prepareActivityCoinChange();
  if(!marineSpecies.some(s=>s.id===id))throw new Error('Unknown animal');
  const state=readMarineSave(),now=Date.now();prepareMarineRound(state,now);
  const entry=state.animals[id];
  // All animals refresh together, keeping exactly one jackpot and two large losses.
  // Greetings never move the deadline; only one effect is applied per animal/round.
  if(entry.met){coinBalance=readCoinBalance();syncCoinHud();return {repeat:true,effect:entry.lastEffect??entry.effect,delta:0};}
  const before=Number(localStorage.getItem(COIN_STORAGE_KEY)||0);
  if(!Number.isSafeInteger(before)||before<0)throw new Error('Invalid coin balance');
  const after=Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,before+entry.effect));
  state.pending={id,before,after,at:now,effect:entry.effect,roundStartedAt:state.roundStartedAt};
  localStorage.setItem(MARINE_SAVE_KEY,JSON.stringify(state));
  try{localStorage.setItem(COIN_STORAGE_KEY,String(after));}
  catch(error){delete state.pending;localStorage.setItem(MARINE_SAVE_KEY,JSON.stringify(state));throw error;}
  // If only this final write fails, the durable receipt still prevents a second debit.
  try{settleMarineReceipt(state);}catch{}
  coinBalance=after;syncCoinHud();return {repeat:false,effect:entry.effect,delta:after-before};
 });
}

let marineDialog=null,marineReturnFocus=null;
function closeMarineEncounter(restoreFocus=true){
 const dialog=marineDialog,target=marineReturnFocus;marineDialog=null;marineReturnFocus=null;
 if(!dialog)return;
 dialog.getAnimations({subtree:true}).forEach(animation=>animation.cancel());dialog.close();dialog.remove();
 document.querySelector('.full-map')?.classList.remove('marine-conversation');
 if(restoreFocus)(target?.isConnected?target:document.querySelector('.map-viewport'))?.focus({preventScroll:true});
}
async function openMarineEncounter(target,id){
 if(screen!=='map'||islandTravelActive||marineDialog)return;
 const species=marineSpecies.find(s=>s.id===id);if(!species)return;
 const dialog=document.createElement('dialog');marineDialog=dialog;marineReturnFocus=target;
 dialog.className='marine-dialog';dialog.setAttribute('aria-labelledby','marine-name');dialog.setAttribute('aria-describedby','marine-message');
 dialog.innerHTML=`<button type="button" class="marine-close" aria-label="Cerrar saludo">×</button><div class="marine-result" role="status" aria-live="polite" aria-busy="true"><p id="marine-message"><span data-marine-speech>¡Hola!</span><small class="marine-return" hidden>Vuelve a intentarlo más tarde.</small></p></div><div class="marine-portrait">${marineArt(species)}<strong class="marine-change" hidden aria-hidden="true"><span data-marine-delta></span>${goldCoinIcon()}</strong></div><div class="marine-identity"><h2 id="marine-name">${species.es}</h2><p class="marine-english" lang="en">${species.en}</p></div><button type="button" class="marine-continue">Continuar <span aria-hidden="true">→</span></button>`;
 dialog.addEventListener('click',event=>{
  event.stopPropagation();
  if(event.target.closest('.marine-close,.marine-continue'))closeMarineEncounter();
  else if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeMarineEncounter();}
 });
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeMarineEncounter();});
 dialog.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.key!=='Tab')return;
  const first=dialog.querySelector('.marine-close'),last=dialog.querySelector('.marine-continue');
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 document.querySelector('.world-app').append(dialog);document.querySelector('.full-map').classList.add('marine-conversation');dialog.showModal();
 try{
  const result=await claimMarineEncounter(id);if(marineDialog!==dialog)return;
  const {effect,delta,repeat}=result;
  const message=repeat?(effect>0?'¡Hola! Ya no tengo monedas.':'¡Hola! No te quitaré más monedas.'):effect>0?(delta>0?`¡Te regalo ${delta} monedas!`:'¡Tu cofre ya está lleno!'):delta===effect?`¡Je, je! Me llevo ${Math.abs(delta)} monedas.`:delta<0?`¡Me llevo tus últimas ${Math.abs(delta)} monedas!`:'¡Ups! Tu cofre está vacío.';
  dialog.querySelector('.marine-result').classList.add(repeat?'marine-greeting':effect>0?'marine-gift':'marine-mischief');
  dialog.querySelector('[data-marine-speech]').textContent=message;
  dialog.querySelector('.marine-return').hidden=!repeat;
  const change=dialog.querySelector('.marine-change');change.hidden=repeat||delta===0;
  change.classList.toggle('is-loss',delta<0);change.querySelector('[data-marine-delta]').textContent=delta>0?`+${delta}`:`−${Math.abs(delta)}`;
  dialog.querySelector('.marine-result').setAttribute('aria-busy','false');
  SoundWorld.play(repeat?'tap':effect>0?'treasure':'wrong');
 }catch{
  if(marineDialog!==dialog)return;
  dialog.querySelector('[data-marine-speech]').textContent='No pude guardar. ¡Tócame otra vez!';
  dialog.querySelector('.marine-result').setAttribute('aria-busy','false');
 }
}
