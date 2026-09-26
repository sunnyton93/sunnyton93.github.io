// Ambient motion stays in CSS; short touch effects use the Web Animations API.
let calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let discovered = new Set();
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
  if(kind==='motion'){calm=!calm;refreshMotion();SoundWorld.play('tap');return;}
  if(kind==='mascot'){announceOcean('¡Hola, Ximena! Soy Coral. ¿Buscamos a mis tres amigos en el océano?');}
  else if(kind==='treasure'){target.classList.toggle('opened');announceOcean(target.classList.contains('opened')?'¡Un tesoro de estrellas! Sigue explorando para conocer nuevos amigos.':'El cofre guarda otra sorpresa para tu próxima visita.');}
  else if(kind==='bubble'){if(target.classList.contains('popped'))return;target.classList.add('popped');setTimeout(()=>target.classList.remove('popped'),1800);}
  else {discovered.add(kind);target.classList.add('greeted');setTimeout(()=>target.classList.remove('greeted'),2500);const word=words.find(w=>w.kind===kind);announceOcean(`${word.en} · ${word.es}${discovered.size===3?' — ¡Encontraste a los tres amigos!':' — ¡Encontraste un amigo!'} `);const counter=document.querySelector('#discovery-count');if(counter)counter.textContent=`${discovered.size}/3 amigos`;}
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
 const canNavigate=()=>screen==='map'&&!islandTravelActive;
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
 canvas.querySelectorAll('.scenic-island,.extra-decor > *,.ocean-toys > button').forEach(el=>mapVisibilityObserver.observe(el));
}
