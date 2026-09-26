const OCEAN_SIZE = {width:6400,height:4400};
const OCEAN_MARGIN=650;
const islandRoutePositions=[
 [[1900,650],[2800,400],[3800,800],[4950,420],[5850,1100],[5250,1800],[4100,1500],[3150,2100],[2150,1650]],
 [[1650,2500],[2450,3000],[3350,2650],[4450,3000],[5550,2600],[5900,3500],[4850,3950],[3700,3500],[2650,3950]]
];
const islandRoutes=[{name:'Ruta del Sol',color:'#ffe08a',islands:[3,4,5,6,7,8,9,10,11]},{name:'Ruta de la Aventura',color:'#b9dcff',islands:[12,13,14,15,16,17,18,19,20]}];
const LUCERO_ROUTES_KEY='ximena-lucero-routes-v1';
function readLuceroRoutes(){try{const value=JSON.parse(localStorage.getItem(LUCERO_ROUTES_KEY)||'[]');return Array.isArray(value)?[...new Set(value.filter(id=>id===0||id===1))]:[];}catch{return [];}}
let luceroOpenRoutes=readLuceroRoutes(),luceroUnlocking=null,luceroGateMessage='';
function luceroRequirement(route){const position=luceroOpenRoutes.indexOf(route);return position===0||luceroOpenRoutes.length===0?24:60;}
function luceroRouteClosed(island){return island.routeIndex!==undefined&&!luceroOpenRoutes.includes(island.routeIndex);}
function luceroLockArt(){return '<svg viewBox="0 0 100 110" aria-hidden="true"><path class="lucero-shackle" d="M26 48V29a24 24 0 0 1 48 0v19" fill="none" stroke="#ffe5a1" stroke-width="12" stroke-linecap="round"/><rect x="12" y="43" width="76" height="60" rx="17" fill="#efbe62" stroke="#fff2bf" stroke-width="4"/><path d="m50 54 6 12 13 2-10 9 3 14-12-7-12 7 3-14-10-9 13-2Z" fill="#91662d"/></svg>';}
function luceroMapGate(){return `<button class="lucero-map-gate ${luceroOpenRoutes.length===2?'is-open':''}" style="left:1360px;top:1290px" data-action="route-gate" aria-label="Candado de Faro Lucero. Elegir camino">${luceroLockArt()}<b>FARO LUCERO</b><small>${islandRoutes.map((_,i)=>`<span>${i===0?'↗':'↘'} ${luceroOpenRoutes.includes(i)?'✓':`★ ${luceroRequirement(i)}`}</span>`).join('')}</small></button>`;}
function openLuceroGate(){cancelGameTurn();luceroGateMessage='';screen='route-gate';render();}
function luceroGateView(){const stars=totalStars();return `${header('Los caminos de Lucero','ELIGE TU AVENTURA')}<section class="lucero-gate"><div class="lucero-stars">★ ${stars} estrellas</div><p>Elige el camino que quieres abrir.</p><div class="lucero-choices">${islandRoutes.map((route,i)=>{const open=luceroOpenRoutes.includes(i),required=luceroRequirement(i);return `<button class="lucero-choice ${open?'is-open':''} ${luceroUnlocking===i?'is-unlocking':''}" data-lucero-route="${i}" style="--route-color:${route.color}" ${luceroUnlocking!==null||stars<required?'disabled':''}><span class="lucero-lock">${luceroLockArt()}<i>★</i><i>★</i><i>★</i></span><b>${route.name}</b><small>${oceanIslands[route.islands[0]].name}</small><strong>${open?'Explorar →':`★ ${required} estrellas`}</strong>${!open&&stars<required?`<span>Faltan ${required-stars} estrellas</span>`:''}</button>`;}).join('')}</div><p class="lucero-status" role="status" aria-live="polite">${luceroUnlocking!==null?'¡Tus estrellas están abriendo el camino!':luceroGateMessage}</p></section>`;}
async function unlockLuceroRoute(route){
 if(screen!=='route-gate'||luceroUnlocking!==null||![0,1].includes(route))return;
 luceroOpenRoutes=readLuceroRoutes();
 if(totalStars()<luceroRequirement(route)){render();return;}
 if(luceroOpenRoutes.includes(route)){voyageToIsland(2,islandRoutes[route].islands[0]);return;}
 const next=[...luceroOpenRoutes,route];
 try{localStorage.setItem(LUCERO_ROUTES_KEY,JSON.stringify(next));}catch{luceroGateMessage='No se pudo guardar el camino. Inténtalo de nuevo.';render();return;}
 luceroOpenRoutes=next;luceroUnlocking=route;render();SoundWorld.play('treasure');
 await new Promise(resolve=>setTimeout(resolve,calm||matchMedia('(prefers-reduced-motion: reduce)').matches?250:1700));
 luceroUnlocking=null;luceroGateMessage=`¡${islandRoutes[route].name} abierta!`;
 if(screen==='route-gate')render();
}
function nextIslands(index){
 if(index<2)return [index+1];
 if(index===2)return islandRoutes.map(route=>route.islands[0]);
 const route=islandRoutes.find(route=>route.islands.includes(index));
 const position=route?.islands.indexOf(index);
 return route&&position+1<route.islands.length?[route.islands[position+1]]:[];
}
let activeVoyage=null;
function islandComplete(index){return progressionModes(index).every(mode=>islandProgress[`${index}-${mode}`]>0);}
function islandRouteCurve(fromIndex,toIndex){
 const from=oceanIslands[fromIndex],to=oceanIslands[toIndex];
 const start=fromIndex===2?{x:1450,y:1420}:{x:from.x,y:from.y+125*from.scale},end={x:to.x,y:to.y+125*to.scale};
 const dx=end.x-start.x,dy=end.y-start.y,distance=Math.hypot(dx,dy)||1;
 const bend=Math.min(340,distance*.28)*(to.routeDepth%2?-1:1);
 const c1={x:start.x+dx*.3-dy/distance*bend,y:start.y+dy*.3+dx/distance*bend};
 const c2={x:start.x+dx*.7-dy/distance*bend,y:start.y+dy*.7+dx/distance*bend};
 return {start,end,c1,c2,distance,path:`M${start.x} ${start.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`};
}
function voyageToIsland(fromIndex,toIndex){
 if(islandTravelActive||!oceanIslands[fromIndex]||!oceanIslands[toIndex])return;
 cancelGameTurn();
 const from=oceanIslands[fromIndex],to=oceanIslands[toIndex];
 const reduced=calm||matchMedia('(prefers-reduced-motion: reduce)').matches;
 screen='map';render();islandTravelActive=true;
 const app=document.querySelector('.world-app'),viewport=document.querySelector('.map-viewport'),canvas=document.querySelector('.map-canvas');
 const {start,end,c1,c2,distance,path:route}=islandRouteCurve(fromIndex,toIndex);
 const point=t=>{const u=1-t;return{x:u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y};};
 const layer=document.createElementNS('http://www.w3.org/2000/svg','svg');
 layer.setAttribute('viewBox',`0 0 ${OCEAN_SIZE.width} ${OCEAN_SIZE.height}`);layer.setAttribute('aria-hidden','true');
 layer.classList.add('voyage-world');layer.style.width=OCEAN_SIZE.width+'px';layer.style.height=OCEAN_SIZE.height+'px';
 layer.innerHTML=`<path class="voyage-route-shadow" d="${route}"/><path class="voyage-route-guide" d="${route}"/><path class="voyage-route-drawn" d="${route}"/><g class="voyage-origin" transform="translate(${from.x} ${from.y})"><ellipse rx="${145*from.scale}" ry="${65*from.scale}"/><text y="-140">★</text></g><g class="voyage-destination" transform="translate(${to.x} ${to.y})"><ellipse rx="${145*to.scale}" ry="${65*to.scale}"/><ellipse rx="${165*to.scale}" ry="${77*to.scale}"/></g><g class="voyage-arrival-cloud"><ellipse rx="155" ry="58" fill="#f3fff270"/><ellipse cx="-45" cy="-15" rx="90" ry="43" fill="#ffffff55"/></g><g class="voyage-wake">${Array.from({length:22},()=>'<circle r="5"/>').join('')}</g><g class="voyage-boat"><g class="voyage-boat-rock"><ellipse cy="16" rx="43" ry="18" fill="#286d6940"/><path d="M-40 0Q-10-36 44 0Q-10 36-40 0Z" fill="#fff4c4" stroke="#b08043" stroke-width="4"/><path d="M-30 0H29" stroke="#cf9d60" stroke-width="5"/><path d="M-4 0v-59" stroke="#705f45" stroke-width="4"/><path class="voyage-sail" d="M-8-55Q-40-32-32-8h24Z" fill="#fffdf0"/><path class="voyage-sail" d="M0-49Q29-35 29-9H0Z" fill="#f4ce71"/><path d="M-3-58 19-53-3-44Z" fill="#e78c7a"/></g></g>`;
 canvas.append(layer);
 const arrivalCloud=layer.querySelector('.voyage-arrival-cloud');
 arrivalCloud.setAttribute('transform',`translate(${start.x} ${start.y})`);
 const drawn=layer.querySelector('.voyage-route-drawn'),length=drawn.getTotalLength(),boat=layer.querySelector('.voyage-boat'),wake=[...layer.querySelectorAll('.voyage-wake circle')];
 drawn.style.strokeDasharray=String(length);drawn.style.strokeDashoffset=String(length);
 const overlay=document.createElement('div');overlay.className=`island-voyage ${reduced?'voyage-calm':''}`;
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',`Viaje de ${from.name} a ${to.name}`);
 overlay.innerHTML=`<div class="voyage-sun-rays" aria-hidden="true"></div><div class="voyage-heading"><span class="voyage-achievement">${islandComplete(fromIndex)?'★ ISLA COMPLETADA':'⚓ NUEVA TRAVESÍA'}</span><p>${from.name} <span aria-hidden="true">→</span></p><h2>${to.name}</h2></div><div class="voyage-controls"><button data-voyage="sound" aria-label="${muted?'Activar':'Silenciar'} sonido">${muted?'♪ ×':'♪ ✓'}</button><button data-voyage="cancel" aria-label="Cerrar viaje y volver al mapa">✕</button></div><div class="voyage-bottom"><div class="voyage-status" role="status">¡Soltamos amarras!</div><div class="voyage-meter" role="progressbar" aria-label="Trayecto" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><button data-voyage="skip" aria-label="Saltar animación y llegar a la isla">Llegar a la isla <span aria-hidden="true">⏭</span></button></div>`;
 document.body.append(overlay);app.inert=true;app.classList.add('voyage-map');
 const camera=(x,y,zoom=1)=>viewport.dispatchEvent(new CustomEvent('voyage-camera',{detail:{x,y,zoom}}));
 const rays=overlay.querySelector('.voyage-sun-rays');
 const meter=overlay.querySelector('.voyage-meter'),fill=meter.querySelector('span'),status=overlay.querySelector('.voyage-status');
 let frame=0,last=performance.now(),elapsed=0,finished=false,phase=-1;
 const sailTime=Math.min(6000,Math.max(3200,distance*1.8)),duration=reduced?650:sailTime+1850;
 const setPhase=next=>{
  if(phase===next)return;phase=next;overlay.dataset.phase=String(next);
  status.textContent=next===0?'¡Soltamos amarras!':next===1?'¡Rumbo a una nueva aventura!':isIslandLocked(to)?'Llegamos a una isla por desbloquear':'¡Tierra a la vista!';
  if(next===2){SoundWorld.play('arrival');layer.classList.add('has-arrived');if(!reduced)burst(innerWidth*.5,innerHeight*.48,32);}
 };
 function finish(arrive){
  if(finished)return;finished=true;cancelAnimationFrame(frame);document.removeEventListener('keydown',onKey,true);document.removeEventListener('visibilitychange',onVisibility);
  layer.remove();overlay.remove();app.inert=false;app.classList.remove('voyage-map');islandTravelActive=false;activeVoyage=null;
  const focusX=arrive?to.x:mapCamera.x+viewport.clientWidth/(2*(mapCamera.zoom||1));
  const focusY=arrive?to.y:mapCamera.y+viewport.clientHeight/(2*(mapCamera.zoom||1));
  camera(focusX,focusY,1);
  if(arrive){startAdventure(toIndex);render();}else viewport.focus({preventScroll:true});
 }
 function onKey(event){
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(false);}
  if(event.key==='Tab'){
   const controls=[...overlay.querySelectorAll('button')],first=controls[0],lastControl=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();lastControl.focus();}
   else if(!event.shiftKey&&document.activeElement===lastControl){event.preventDefault();first.focus();}
  }
 }
 overlay.addEventListener('click',event=>{
  const action=event.target.closest('[data-voyage]')?.dataset.voyage;
  if(action==='cancel')finish(false);
  if(action==='skip'){setPhase(2);finish(true);}
  if(action==='sound'){SoundWorld.toggle();const button=overlay.querySelector('[data-voyage="sound"]');button.textContent=muted?'♪ ×':'♪ ✓';button.setAttribute('aria-label',muted?'Activar sonido':'Silenciar sonido');}
 });
 document.addEventListener('keydown',onKey,true);overlay.querySelector('[data-voyage="skip"]').focus({preventScroll:true});
 activeVoyage={fromIndex,toIndex,cancel:()=>finish(false),skip:()=>{setPhase(2);finish(true);}};
 SoundWorld.play('departure');
 if(reduced){
  arrivalCloud.style.display='none';
  const minX=Math.min(start.x,end.x,c1.x,c2.x)-200,maxX=Math.max(start.x,end.x,c1.x,c2.x)+200;
  const minY=Math.min(from.y,to.y,c1.y,c2.y)-200,maxY=Math.max(start.y,end.y,c1.y,c2.y)+200;
  camera((minX+maxX)/2,(minY+maxY)/2,Math.min(1,viewport.clientWidth/(maxX-minX),viewport.clientHeight/(maxY-minY)));
  drawn.style.strokeDashoffset='0';boat.style.display='none';setPhase(1);
 }else{camera(from.x,from.y,.95);burst(innerWidth*.5,innerHeight*.5,24);}
 function tick(now){
  if(finished)return;
  const delta=Math.min(80,now-last);last=now;
  if(document.hidden){frame=0;return;}elapsed+=delta;
  const progress=Math.max(0,Math.min(1,(elapsed-750)/sailTime));
  if(!reduced){
   const eased=progress*progress*(3-2*progress),p=point(eased),ahead=point(Math.min(1,eased+.002)),behind=point(Math.max(0,eased-.002));
   const heading=Math.atan2(ahead.y-behind.y,ahead.x-behind.x)*180/Math.PI;
   boat.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${heading*.35})`);
   // Mist and boat share the exact path point, including departure and arrival.
   arrivalCloud.setAttribute('transform',`translate(${p.x} ${p.y})`);
   drawn.style.strokeDashoffset=String(length*(1-eased));
   wake.forEach((dot,i)=>{const t=Math.max(0,eased-(i+1)*.004),q=point(t);dot.setAttribute('cx',String(q.x));dot.setAttribute('cy',String(q.y+Math.sin(now/180+i)*5));dot.setAttribute('r',String(2+(22-i)*.2));dot.style.opacity=eased>0?String((1-i/22)*.65):'0';});
   const departure=Math.min(1,elapsed/750),arrival=Math.min(1,Math.max(0,(elapsed-750-sailTime)/1100));
   const zoom=.95-.15*Math.min(1,departure)+.2*arrival;
   camera(p.x+(to.x-p.x)*arrival,(p.y-105)+(to.y-(p.y-105))*arrival,zoom);
   rays.style.left=`${(p.x-mapCamera.x)*mapCamera.zoom}px`;rays.style.top=`${(p.y-mapCamera.y)*mapCamera.zoom}px`;
   setPhase(elapsed<750?0:progress<1?1:2);
  }
  const percent=Math.round((reduced?elapsed/duration:progress)*100);meter.setAttribute('aria-valuenow',String(Math.min(100,percent)));fill.style.width=Math.min(100,percent)+'%';
  if(elapsed>=duration){finish(true);return;}frame=requestAnimationFrame(tick);
 }
 function onVisibility(){cancelAnimationFrame(frame);frame=0;last=performance.now();if(!document.hidden&&!finished)frame=requestAnimationFrame(tick);}
 document.addEventListener('visibilitychange',onVisibility);
 if(!document.hidden)frame=requestAnimationFrame(tick);
}
let islandTravelActive = false;
function adventureSound(){SoundWorld.play('travel');}
async function enterIsland(index,action,developerAccess=false){
 if(islandTravelActive)return;
 const island=oceanIslands[index];if(!island)return;
 developerAccess=developerAccess&&islandDevSettings.rightClickEntry;
 if(luceroRouteClosed(island)&&!developerAccess){openLuceroGate();return;}
 if(isIslandLocked(island)&&!developerAccess){lockedIslandIndex=index;cancelGameTurn();screen='locked';SoundWorld.play('locked');render();return;}
 islandTravelActive=true;
 adventureSound();
 const reduced=calm||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const app=document.querySelector('.world-app'),canvas=document.querySelector('.map-canvas');
 const cover=document.createElement('div');cover.className='island-travel';cover.setAttribute('role','status');cover.setAttribute('aria-live','polite');
 cover.innerHTML=`<div class="travel-vignette"></div><div class="travel-cloud travel-cloud-left"></div><div class="travel-cloud travel-cloud-right"></div><div class="travel-title"><span class="travel-compass">✦</span><small>RUMBO A UNA NUEVA AVENTURA</small><h2>${island.name}</h2><p>${index<2?'¡Vamos, Ximena!':'¡Una isla por descubrir!'}</p><div class="travel-dots">✧ &nbsp; ✦ &nbsp; ✧</div></div>`;
 document.body.append(cover);app.inert=true;
 const animations=[];
 try{
  const duration=reduced?220:1500;
  if(!reduced){
   const scale=Math.min(1.2,(mapCamera.zoom||.75)*1.6);
   const tx=Math.max(innerWidth-(OCEAN_SIZE.width+OCEAN_MARGIN)*scale,Math.min(OCEAN_MARGIN*scale,innerWidth/2-island.x*scale)),ty=Math.max(innerHeight-(OCEAN_SIZE.height+OCEAN_MARGIN)*scale,Math.min(OCEAN_MARGIN*scale,innerHeight*.47-(island.y-30)*scale));
   animations.push(canvas.animate([{transform:canvas.style.transform},{transform:`translate3d(${tx}px,${ty}px,0) scale(${scale})`}],{duration:1450,easing:'cubic-bezier(.22,.55,.26,1)',fill:'forwards'}));
   for(const el of app.querySelectorAll('.hud-container,.map-navigation,.discovery-hint'))animations.push(el.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}));
   cover.classList.add('travel-moving');
  }else cover.classList.add('travel-reduced');
  await new Promise(resolve=>setTimeout(resolve,duration));
  startAdventure(index,null,developerAccess);
  render();

  const fade=cover.animate([{opacity:1},{opacity:0}],{duration:reduced?120:300,easing:'ease-out',fill:'forwards'});
  await fade.finished;
 }finally{
  animations.forEach(animation=>animation.cancel());cover.remove();app.inert=false;islandTravelActive=false;
 }
}
const oceanIslands = [
 {x:290,y:380,type:'palms',name:'Playa Palmita',color:'#a5d987',scale:1.1},
 {x:670,y:430,type:'lagoon',name:'Laguna Tortuga',color:'#80d7b0',scale:1.25},
 {x:1170,y:300,type:'lighthouse',name:'Faro Lucero',color:'#b9d8a0',scale:1.15},
 {x:1760,y:460,type:'coral',name:'Jardín de Coral',color:'#c6b7e6',scale:1.3},
 {x:2470,y:360,type:'waterfall',name:'Cascada Esmeralda',color:'#71c99b',scale:1.5},
 {x:2800,y:960,type:'volcano',name:'Volcán Dormilón',color:'#b6be89',scale:1.4},
 {x:2130,y:1130,type:'village',name:'Puerto Caracol',color:'#b5d99b',scale:1.4},
 {x:1420,y:1010,type:'shell',name:'Bahía de las Perlas',color:'#e1b7d1',scale:1.3},
 {x:620,y:1120,type:'forest',name:'Bosque Mariposa',color:'#7bc39a',scale:1.4},
 {x:380,y:1690,type:'ship',name:'La Isla del Tesoro',color:'#c6d78b',scale:1.35},
 {x:1270,y:1740,type:'ice',name:'Glaciar Brillante',color:'#b6e9ea',scale:1.45},
 {x:2370,y:1730,type:'castle',name:'Castillo del Sol',color:'#d5d9a1',scale:1.5},
 {x:1160,y:680,type:'football',name:'Isla Messi',color:'#76bd84',scale:1.6},
 {x:1850,y:1680,type:'basketball',name:'Isla Canasta',color:'#d4c399',scale:1.2},
 {x:2810,y:1490,type:'music',name:'Isla Melodía',color:'#c7b1de',scale:1.15},
 {x:3430,y:420,type:'chess',name:'Isla Ajedrez',color:'#b8c3da',scale:1.45},
 {x:4170,y:650,type:'dogs',name:'Isla de los Perros',color:'#b9d994',scale:1.5},
 {x:3500,y:1190,type:'pirates',name:'Piratas del Caribe',color:'#8fbea9',scale:1.55},
 {x:4240,y:1400,type:'haaland',name:'Isla Erling Haaland',color:'#90d4cf',scale:1.6},
 {x:3430,y:2070,type:'school',name:'Isla de la Escuela',color:'#e7cc91',scale:1.45},
 {x:4220,y:2200,type:'kart',name:'Isla Mario Kart',color:'#b7d994',scale:1.6}
].map((island,index)=>{
 const routeIndex=islandRoutes.findIndex(route=>route.islands.includes(index));
 if(routeIndex<0)return {...island,...(index===2?{y:1100}:{}),get requiredStars(){return index*6;},routeDepth:index};
 const position=islandRoutes[routeIndex].islands.indexOf(index);
 const [x,y]=islandRoutePositions[routeIndex][position];
 return {...island,x,y,routeIndex,routeDepth:position+3,get requiredStars(){return Math.max((position+3)*6,luceroRequirement(routeIndex));}};
});
function islandPaths(){
 return oceanIslands.flatMap((from,index)=>nextIslands(index).map(toIndex=>{
  const to=oceanIslands[toIndex],color=to.routeIndex===undefined?'#fff3c3':islandRoutes[to.routeIndex].color;
  return `<path class="island-route" data-from="${index}" data-to="${toIndex}" d="${islandRouteCurve(index,toIndex).path}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 17" opacity="${luceroRouteClosed(to)?'.28':'.7'}"/>`;
 })).join('')+'<path d="M1170 1244Q1300 1230 1450 1420" fill="none" stroke="#fff3c3" stroke-width="6" stroke-dasharray="2 17" stroke-linecap="round"/>'+islandRoutes.map((route,i)=>`<text x="${i===0?1900:1650}" y="${i===0?350:2200}" text-anchor="middle" fill="${route.color}" stroke="#397f83" stroke-width=".5" font-size="30" font-weight="bold">${route.name}</text>`).join('');
}
function palm(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="7" cy="10" rx="27" ry="7" fill="#246d5630"/><path d="M0 9Q-12-41 8-84" stroke="#99704b" stroke-width="13" fill="none"/><path d="M-3 7Q-15-41 5-82" stroke="#d2ad71" stroke-width="5" fill="none"/><path d="m-8-12 11 2m-12-18 11 2m-9-18 11 3m-6-17 10 3" stroke="#816342" stroke-width="2" opacity=".55"/><g class="palm-crown"><path d="M8-82Q-46-125-64-64Q-27-90 8-82Q-4-141 34-125Q24-100 8-82Q63-124 80-77Q47-93 8-82Q51-82 49-46Q29-70 8-82Q-33-82-38-44Q-44-85 8-82" fill="#2b9d78"/><path d="M8-82Q-34-117-64-64Q-42-105 8-82M8-82Q53-115 80-77Q54-99 8-82M8-82Q-2-119 34-125Q17-110 8-82" fill="#68b987"/><path d="M8-82Q-13-110-40-90M8-82Q39-102 61-86" stroke="#8dcf89" stroke-width="4" fill="none"/><circle cx="8" cy="-77" r="7" fill="#ba8c4e"/><circle cx="-2" cy="-77" r="6" fill="#c8a164"/></g></g>`;}
function coral(x,y,c,s=1){return `<g transform="translate(${x} ${y}) scale(${s})"><g class="coral-sway"><path d="M0 12V-55M0-12Q-28-15-29-42M0-29Q26-27 24-65M-29-29-44-47M24-42 40-54" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/></g></g>`;}
function house(x,y,c){return `<g transform="translate(${x} ${y})"><ellipse cy="5" rx="33" ry="8" fill="#29684f26"/><rect x="-24" y="-39" width="48" height="40" rx="4" fill="#fff0cb"/><path d="M13-39h11V1H13Z" fill="#d6c29a"/><path d="m-32-37 32-34 32 34z" fill="${c}"/><rect x="-5" y="-22" width="13" height="23" rx="5" fill="#719b91"/><rect x="-18" y="-24" width="8" height="10" fill="#e9bc65"/></g>`;}
function islandScenery(type){const art={
 football:`<g class="stadium-crowd"><path d="m-91-68 18-20H75l22 20-12 9H-77z" fill="#effbfa"/><path d="M-68-76H68M-77-67H77" stroke="#8acbe5" stroke-width="5"/><path d="M-62-78h8m10 0h8m10 0h8m10 0h8m10 0h8m10 0h8m10 0h8" stroke="#e9bd72" stroke-width="4"/></g><path d="M-99 9V-64h198V9Z" fill="#2c9867" stroke="#edf4cd" stroke-width="4"/><path d="M-65-62V8M0-62V8M65-62V8" stroke="#77c98a" stroke-width="31" opacity=".5"/><g stroke="#edfbe4" fill="none" stroke-width="2"><path d="M0-63V9M-98-44h24v34h-24m196-34H74v34h24"/><ellipse cy="-27" rx="19" ry="17"/></g><g stroke="#f7ffed" fill="#d9f6ef66" stroke-width="3"><path d="m-100-45-14-11v39l14 8zm200 0 14-11v39L100-9z"/></g><path d="m-108-49 8 4m-8 6 8 4m-8 6 8 4m208-24-8 4m8 6-8 4m8 6-8 4" stroke="#fff" stroke-width="1"/><g class="football-bounce"><circle cx="20" cy="-22" r="10" fill="#fffbe9"/><path d="m20-28 6 4-2 7h-8l-2-7z" fill="#36595b"/></g><g class="harbor-flag"><path d="M-99-63v-49m198 49v-49" stroke="#f6eed0" stroke-width="3"/><path d="m-97-112 30 5v18l-30-5m198-18 30 5v18l-30-5" fill="#87cee6"/><path d="m-97-106 30 5v6l-30-5m198-11 30 5v6l-30-5" fill="#fff"/></g><rect x="-36" y="-121" width="72" height="32" rx="7" fill="#316b65" stroke="#f4dda1" stroke-width="3"/><text x="0" y="-108" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff9d8">MESSI</text><text x="0" y="-94" text-anchor="middle" font-size="13" font-weight="bold" fill="#f7dd90">10</text><g class="stadium-lights" fill="#fffbd0"><circle cx="-96" cy="-114" r="4"/><circle cx="101" cy="-114" r="4"/></g>`,
 basketball:`<rect x="-80" y="-42" width="160" height="71" rx="8" fill="#d89269" stroke="#fff0cd" stroke-width="3"/><path d="M0-41v70" stroke="#fff0cd" stroke-width="2"/><ellipse cy="-6" rx="19" ry="16" fill="none" stroke="#fff0cd" stroke-width="2"/><path d="M-63-5v-81m126 81v-81" stroke="#718f8a" stroke-width="5"/><path d="M-82-90h38v27h-38zm126 0h38v27H44z" fill="#edf6df" stroke="#8cc2c2" stroke-width="3"/><ellipse cx="-63" cy="-60" rx="13" ry="4" fill="none" stroke="#dd825e" stroke-width="3"/><ellipse cx="63" cy="-60" rx="13" ry="4" fill="none" stroke="#dd825e" stroke-width="3"/><g class="football-bounce"><circle cx="24" cy="-12" r="12" fill="#efa257"/><path d="M12-12h24m-12-12v24m-8-21q12 9 0 18" stroke="#996947" fill="none" stroke-width="1.5"/></g>`,
 music:`<ellipse cy="3" rx="83" ry="33" fill="#aa91ca"/><ellipse cy="-5" rx="78" ry="29" fill="#dfc9e9"/><path d="M-39 5v-68l72-17v70" stroke="#6c7c9c" stroke-width="9" fill="none"/><ellipse cx="-52" cy="5" rx="18" ry="12" fill="#6c7c9c"/><ellipse cx="21" cy="-10" rx="18" ry="12" fill="#6c7c9c"/><g class="music-notes" fill="#fae2a2" font-size="29"><text x="-80" y="-66">♪</text><text x="55" y="-87">♫</text></g><path d="M-83 17h164" stroke="#fff0c9" stroke-width="6" stroke-dasharray="10 3"/>`,
 palms:`${palm(-47,-15,.9)}${palm(44,-7,.65)}<path d="m-14 2 40 10-17 15-38-9z" fill="#ffefdb"/><path d="m-7 4 8 3-16 16-8-3" fill="#f0a693"/><g class="beach-ball"><circle cx="69" cy="8" r="13" fill="#fff3c5"/><path d="M69-5q18 13 0 26Q55 8 69-5" fill="#f5987e"/></g>`,
 lagoon:`<path d="M-87-4Q-81-37-35-32T36-28Q83-35 87-3T25 30Q-7 24-41 30T-87-4Z" fill="#f6e6aa"/><path d="M-72-6Q-65-28-30-23T29-20Q68-29 72-4T24 19Q-3 12-35 20T-72-6Z" fill="#65c7c3"/><path d="M-51-6Q-43-22-15-16T34-16Q63-14 52 3T-7 9Q-50 16-51-6Z" fill="#359aa8"/><path class="lagoon-ripple" d="M-63-6Q-51-29-18-19M-49 13Q-14 20 9 13M39 12Q67 8 62-7" fill="none" stroke="#c2f4dc" stroke-width="2" stroke-linecap="round"/>${palm(-71,-24,.55)}<g class="tiny-turtle" transform="translate(15 -14)"><ellipse rx="23" ry="15" fill="#488a6a"/><path d="m-15-9 14-5 14 11-11 12-15-5z" fill="#96ca79"/><circle cx="29" cy="-4" r="10" fill="#a4db99"/><circle cx="33" cy="-7" r="2" fill="#285e53"/></g>`,
 lighthouse:`<path class="lighthouse-beam" d="M0-114 230-165 235-80Z" fill="#fff4b7" opacity=".3"/><path d="m-28 6 9-121h37L31 6z" fill="#fff2d1"/><path d="m-23-39 44 1 4 23-50-1m5-70h40l2 21h-44" fill="#e88c78"/><rect x="-24" y="-126" width="48" height="23" rx="5" fill="#74a3a1"/><rect x="-15" y="-122" width="30" height="13" fill="#ffe995"/><path d="m-32-127 32-24 32 24z" fill="#d67362"/><path d="M9-114h9L31 6H10Z" fill="#795b5630"/><path d="M-23 9H32" stroke="#938f74" stroke-width="5" stroke-linecap="round"/><rect x="-7" y="-16" width="15" height="25" rx="7" fill="#68928a"/><path d="M-76 18h45m47 4h58" stroke="#ece3c3" stroke-width="10" stroke-linecap="round"/>`,
 coral:`${coral(-64,0,'#e78eb3',.85)}${coral(48,0,'#f59e89',1)}${coral(-13,-10,'#8c8bd5',.8)}<g class="pearl-glow"><ellipse cx="2" cy="16" rx="31" ry="13" fill="#ead4ea"/><circle cx="2" cy="6" r="12" fill="#fff4e4"/></g><path d="m75 18 7-14 5 13 14 2-12 7 2 12-12-7-11 5 3-12-9-7z" fill="#ffe3a4"/>`,
 waterfall:`<path d="m-88 6 21-102 48-37 33 28 37-9 30 62L98 9Z" fill="#609b82"/><path d="m-67-96 48-37 33 28 37-9-13 35-43-7-38 15z" fill="#a2d092"/><path d="M-16-89H22L34 35H-26Z" fill="#91e6df"/><g class="waterfall-stream"><path d="M-9-88 0 31M8-88 15 32M18-82 27 32" stroke="#edfff1" stroke-width="4" stroke-dasharray="14 12" fill="none"/></g><ellipse cy="34" rx="57" ry="17" fill="#72cfc5"/><ellipse class="lagoon-ripple" cy="34" rx="37" ry="10" fill="none" stroke="#d7fff0" stroke-width="3"/>`,
 volcano:`<g class="volcano-puffs" fill="#ffecd6"><circle cx="-8" cy="-121" r="13"/><circle cx="12" cy="-146" r="17"/><circle cx="-7" cy="-175" r="21"/></g><path d="m-86 13 52-105h58L88 13z" fill="#ad8c80"/><path d="m-34-92 17 30 12-9 18 39 3-44 20 14-12-30z" fill="#f2b27d"/><ellipse cx="-5" cy="-92" rx="29" ry="10" fill="#775f63"/><ellipse cx="-5" cy="-94" rx="19" ry="5" fill="#ffd9a0"/><path d="m-68 11 28-27 9 24m65 0 10-29 22 31" fill="#cfad92"/>`,
 village:`${house(-53,-15,'#e88f77')}${house(20,-39,'#88b7c2')}${house(66,5,'#edc276')}<path d="M-10 18 14 62h30L19 17" fill="#c9935c"/><path d="m-3 27 25-1M3 37l25-1M9 47h25" stroke="#f0cc8c" stroke-width="3"/><g class="harbor-flag"><path d="M-78-34v-52" stroke="#9a7d5e" stroke-width="3"/><path d="m-77-86 31 8-31 13" fill="#ffcc75"/></g>`,
 shell:`<g class="shell-breathe"><path d="M-63 9Q-101-24-62-50Q-61-85-27-77Q0-111 29-77Q69-83 67-45Q105-14 62 11Z" fill="#efb8ce" stroke="#ffe1dc" stroke-width="5"/><path d="M0 14-52-47M0 14-23-75M0 14 25-73M0 14 57-43" stroke="#d997b9" stroke-width="4"/><ellipse cy="15" rx="65" ry="17" fill="#d79fbf"/><circle class="pearl-glow" cy="-1" r="24" fill="#fff8e0"/></g>`,
 forest:`${[-65,-22,25,67].map((x,i)=>`<g transform="translate(${x} ${i%2?-28:0})"><path d="M0 7V-57" stroke="#977451" stroke-width="9"/><ellipse cy="-62" rx="28" ry="41" fill="${i%2?'#389477':'#67b285'}"/><ellipse cx="-8" cy="-74" rx="12" ry="20" fill="#b2d89955"/></g>`).join('')}<g class="butterfly"><path d="M0 0Q-26-32-24-5Q-19 14 0 0Q23-32 24-5Q18 13 0 0" fill="#f8c776"/></g>`,
 ship:`<g class="wreck-rock"><path d="m-78-5 154 2-24 38H-49Z" fill="#b67f51" stroke="#efd3a0" stroke-width="4"/><path d="M-8 1V-112" stroke="#987c5a" stroke-width="7"/><path class="sail-flutter" d="M-16-103Q-76-69-57-31h41zm15 9q61 23 65 66H-1z" fill="#fff0ce"/><path d="m-8-112 35 6-35 13z" fill="#e78c7b"/><circle cx="-37" cy="11" r="6" fill="#735f55"/><circle cx="27" cy="11" r="6" fill="#735f55"/></g>`,
 ice:`<path d="m-94 12 40-107 25 38L5-142 55-59 80-72 28 18Z" fill="#b9e9e9"/><path d="m-54-95 25 38-13 9zm59-47 18 49-30-8zm50 83 25-13-10 27z" fill="#fffcec"/><path d="M5-142 3 12l25 6 27-77z" fill="#86c9da"/><g class="ice-sparkles" fill="#fffdf0"><path d="m-64-30 4 9 10 3-10 3-4 10-3-10-10-3 10-3z"/><path d="m41-82 4 9 10 3-10 3-4 10-3-10-10-3 10-3z"/></g>`,
 castle:`<path d="M-68 14V-64h35V-27h64v-37h37v78" fill="#f1d4a0"/><path d="M-30 12V-103H30V12" fill="#ffe6b7"/><path d="m-77-65 26-43 27 43m-16-38 40-43 40 43m-18 38 28-43 27 43" fill="#9eb7d1"/><path d="M-12 16V-11q12-22 24 0v27" fill="#9baa9a"/><path d="M-9-70h18v22H-9" fill="#d0ad72"/><g class="harbor-flag"><path d="M0-146v-28" stroke="#a48b68" stroke-width="3"/><path d="m1-175 31 9-31 9" fill="#efb770"/></g>`
 };return art[type]||newIslandScenery(type);}
function newIslandScenery(type){
 const art={
 chess:`<g transform="translate(-87 -42) skewX(-12)"><rect width="176" height="88" rx="8" fill="#525a77" stroke="#fff4d3" stroke-width="5"/>${Array.from({length:32},(_,i)=>`<rect x="${i%8*22}" y="${Math.floor(i/8)*22}" width="22" height="22" fill="${(i%8+Math.floor(i/8))%2?'#6e7594':'#fff0cc'}"/>`).join('')}</g><g class="chess-crown" fill="#fff0c8" stroke="#bd9c65" stroke-width="3"><path d="M-29-2h59l-7-16H-23zM-21-18l9-40h25l9 40z"/><path d="M-21-59h43l-4-28H-18z"/><path d="M0-119v29m-12-18h24" fill="none" stroke-width="7"/></g><g fill="#59637c" stroke="#343f56" stroke-width="2"><ellipse cx="-58" cy="4" rx="17" ry="6"/><path d="m-69 1 7-25h8l7 25z"/><circle cx="-58" cy="-31" r="11"/></g><g fill="#e7c67a"><path d="m64-68 4 11 12 1-10 7 3 12-9-7-10 7 4-12-10-7 12-1z"/></g>`,
 dogs:`<path d="M-93 10v-76h87v76" fill="#f4d498" stroke="#bd9060" stroke-width="3"/><path d="m-104-64 55-49 55 49z" fill="#df8f73"/><path d="M-67 9v-34q18-28 36 0V9" fill="#9b7454"/><rect x="-69" y="-63" width="39" height="13" rx="6" fill="#fff2cf"/><g transform="translate(49 -8)"><path class="puppy-tail" d="M22 2q40-30 32-51" fill="none" stroke="#b87a51" stroke-width="11" stroke-linecap="round"/><ellipse cy="6" rx="30" ry="24" fill="#d59b67"/><ellipse cx="-14" cy="22" rx="12" ry="7" fill="#f8dfb0"/><ellipse cx="18" cy="22" rx="12" ry="7" fill="#f8dfb0"/><ellipse cy="-27" rx="31" ry="27" fill="#f2c98f"/><ellipse cx="-29" cy="-34" rx="11" ry="23" fill="#ad734d" transform="rotate(19 -29 -34)"/><ellipse cx="29" cy="-34" rx="11" ry="23" fill="#ad734d" transform="rotate(-19 29 -34)"/><circle cx="-11" cy="-31" r="3" fill="#36494b"/><circle cx="11" cy="-31" r="3" fill="#36494b"/><ellipse cy="-19" rx="8" ry="5" fill="#36494b"/><path d="M-5-9q5 13 10 0" fill="#df8e93"/><path d="M-21-1h42" stroke="#61b3aa" stroke-width="6"/><circle cy="4" r="5" fill="#f8d577"/></g>`,
 pirates:`<g class="wreck-rock"><path d="m-97-1 185 0-27 39H-63z" fill="#424c54" stroke="#bd965d" stroke-width="4"/><path d="M-93 9H80" stroke="#d6b279" stroke-width="3"/><path d="M-15 0v-136M42-3v-106" stroke="#816748" stroke-width="6"/><path class="sail-flutter" d="M-20-122q-57 22-51 83h51zm12 0q48 20 42 83H-8zM48-97q38 17 35 62H48z" fill="#303e4c" stroke="#677381" stroke-width="2"/><g transform="translate(8 -83)" fill="#ece1c9"><circle cy="-5" r="10"/><rect x="-6" y="1" width="12" height="7"/><path d="m-13 13 26 13m0-13-26 13" stroke="#ece1c9" stroke-width="4"/><circle cx="-4" cy="-6" r="2" fill="#303e4c"/><circle cx="4" cy="-6" r="2" fill="#303e4c"/></g><path class="harbor-flag" d="m-14-135 36 4-8 15-28-4" fill="#943f47"/><g fill="#d6ab68">${[-58,-25,9,44].map(x=>`<circle cx="${x}" cy="16" r="5"/>`).join('')}</g></g><g transform="translate(-76 17)"><rect width="32" height="22" rx="4" fill="#ba7c43" stroke="#f6d176" stroke-width="3"/><path d="M16 1v20" stroke="#f6d176" stroke-width="5"/></g>`,
 haaland:`<rect x="-103" y="-25" width="206" height="58" rx="9" fill="#42996c" stroke="#eef9db" stroke-width="4"/><path d="M0-24v54" stroke="#effade" stroke-width="2"/><ellipse cy="4" rx="25" ry="17" fill="none" stroke="#effade" stroke-width="2"/><path d="M60-4v-65h44v65m-36-62v62m10-62v62m10-62v62M62-49h40M62-33h40M62-17h40" fill="none" stroke="#eaf5df" stroke-width="3"/><g transform="translate(-24 -19)"><path d="m-20-49-22 18 12 15 14-8v41h41v-41l14 8 12-15-22-18" fill="#92d5e7" stroke="#4f9db8" stroke-width="3"/><text x="5" y="3" text-anchor="middle" fill="#fff" font-size="29" font-weight="bold">9</text><circle cx="5" cy="-72" r="22" fill="#f2d5b4"/><path d="M-16-78q2-28 37-16l4 17-15-7-26 6" fill="#f1d17f"/><circle cx="29" cy="-84" r="9" fill="#e7bf65"/><path d="M-4-69h2m14 0h2" stroke="#3b6169" stroke-width="3" stroke-linecap="round"/></g><g class="football-bounce"><circle cx="-67" cy="10" r="13" fill="#fffbe3"/><path d="m-67 3 7 5-3 8h-8l-3-8z" fill="#37616a"/></g><rect x="-54" y="-146" width="110" height="25" rx="7" fill="#3f7484"/><text y="-129" text-anchor="middle" font-size="13" font-weight="bold" fill="#fff3c8">HAALAND</text>`,
 school:`<rect x="-79" y="-65" width="158" height="89" rx="4" fill="#f3c67f" stroke="#bb8953" stroke-width="3"/><path d="m-92-64 91-56 94 56z" fill="#d57569"/><rect x="-21" y="-21" width="42" height="45" rx="7" fill="#749a92"/><path d="M0-20v44" stroke="#bde1c7" stroke-width="2"/>${[-57,40].map(x=>`<rect x="${x}" y="-48" width="23" height="28" rx="4" fill="#a1d9de" stroke="#fff0c7" stroke-width="4"/>`).join('')}<circle cy="-73" r="16" fill="#fff6d8" stroke="#b98056" stroke-width="3"/><path d="M0-84v12l9 4" stroke="#5e847d" stroke-width="3" fill="none"/><g class="harbor-flag"><path d="M78-53v-71" stroke="#6d887b" stroke-width="4"/><path d="m80-124 28 8-28 15" fill="#76bbaa"/></g><g class="school-book"><path d="M-45 25q22-9 43 1v23q-21-10-43-1zm43 1q22-10 43-1v23q-21-9-43 1z" fill="#fff4c8" stroke="#7395b1" stroke-width="3"/><path d="M-2 27v21" stroke="#ceab79" stroke-width="2"/></g>`,
 kart:`<ellipse cy="-6" rx="104" ry="48" fill="#827fa7" stroke="#faf0cb" stroke-width="6"/><ellipse cy="-6" rx="68" ry="24" fill="#a6d795" stroke="#f8d480" stroke-width="7"/><ellipse cy="-6" rx="90" ry="38" fill="none" stroke="#fff5ce" stroke-width="2" stroke-dasharray="9 9"/><path d="M-78-5v-76m0 0h41v28h-41" fill="#fff5d7" stroke="#5c7d75" stroke-width="4"/><path d="M-78-77h10v12h-10m20 0h10v12h-10m-20 0h10v12h-10m20-24h10v12h-10" fill="#4f5a71"/><g class="kart-racer" transform="translate(24 -7)"><rect x="-31" y="-6" width="64" height="25" rx="10" fill="#e57465" stroke="#b45d55" stroke-width="3"/><circle cx="-20" cy="18" r="9" fill="#45556a"/><circle cx="23" cy="18" r="9" fill="#45556a"/><path d="M-13-2v-16h25V0" fill="#688abe"/><circle cy="-33" r="16" fill="#f5d0a8"/><path d="M-17-38q0-23 29-14l6 16h-40" fill="#df655d"/><circle cy="-46" r="7" fill="#fff4d7"/><text y="-42" text-anchor="middle" font-size="10" font-weight="bold" fill="#d65b52">M</text><path d="M-8-28q8-7 16 0" stroke="#745544" stroke-width="5" fill="none"/></g><g class="kart-item" transform="translate(60 -88)"><rect x="-15" y="-17" width="30" height="30" rx="6" fill="#f2c963" stroke="#fff3c8" stroke-width="3"/><text y="7" text-anchor="middle" font-size="25" font-weight="bold" fill="#fff8de">?</text></g><g transform="translate(-11 -86)"><path d="M-8 1h17v18H-8z" fill="#fff3d7"/><path d="M-23 2q-1-36 24-36T25 2z" fill="#e77b73"/><circle cx="-8" cy="-13" r="7" fill="#fff4d6"/><circle cx="14" cy="-15" r="6" fill="#fff4d6"/></g>`
 };
 return art[type]||'';
}
// Stable, smooth coastlines: the same island keeps its silhouette on every visit.
function islandCoast(index,type){
 const points=Array.from({length:12},(_,j)=>{
  const angle=j*Math.PI/6,seed=index*.83;
  const radius=1+.095*Math.sin(angle*3+seed)+.055*Math.cos(angle*5-seed);
  return {x:Math.cos(angle)*(type==='ship'?137:128)*radius,y:Math.sin(angle)*48*radius+Math.sin(angle*2+seed)*5};
 });
 const number=n=>n.toFixed(1);
 let path=`M${number(points[0].x)} ${number(points[0].y)}`;
 points.forEach((p,i)=>{
  const prev=points[(i+11)%12],next=points[(i+1)%12],after=points[(i+2)%12];
  path+=`C${number(p.x+(next.x-prev.x)/6)} ${number(p.y+(next.y-prev.y)/6)} ${number(next.x-(after.x-p.x)/6)} ${number(next.y-(after.y-p.y)/6)} ${number(next.x)} ${number(next.y)}`;
 });
 return path+'Z';
}
function islandEdgeDetails(type,index){
 const ice=type==='ice',rocky=type==='volcano';
 const stones=[[-110,5],[-89,27],[97,23],[114,-4]].map(([x,y],j)=>{
  const size=5+(index+j)%4;
  return `<g transform="translate(${x} ${y})"><ellipse cy="4" rx="${size+3}" ry="3" fill="#365b4f22"/><path d="M-${size} 2l3-${size+2} ${size}-2 5 ${size-1}-4 5Z" fill="${ice?'#bde4ed':rocky?'#8b8585':'#b6b6a2'}"/><path d="M-${size} 2l3-${size+2} ${size}-2-2 5Z" fill="${ice?'#f1ffff':'#ded7be'}"/></g>`;
 }).join('');
 if(ice||rocky)return stones;
 return stones+[[-94,-5],[88,6],[-66,31],[67,30]].map(([x,y],j)=>`<g transform="translate(${x} ${y})"><ellipse cy="4" rx="14" ry="4" fill="#3c745827"/><path d="M-13 2Q-19-9-10-11q3-10 10-5 11-7 13 5 10 1 8 12Z" fill="${['#659b76','#72ae7c','#83b780'][(index+j)%3]}"/><path d="M-10-6q5-9 10-4m2 0q5-6 9 0" fill="none" stroke="#b5d49a" stroke-width="2.5" stroke-linecap="round"/>${j%2?'<circle cx="-4" cy="-7" r="2.3" fill="#f5df9f"/><circle cx="4" cy="-5" r="1.7" fill="#f3c397"/>':''}</g>`).join('');
}
function scenicIsland(item,i){
 const {x,y,scale:s,color,type,name}=item,shape=islandCoast(i,type),ice=type==='ice';
 const prefix=`terrain-${i}`,sand=ice?'#e1f7ef':'#f5dfae',stone=ice?'#79b8c5':'#aa8864';
 return `<g class="scenic-island ${isIslandLocked(item)?'scenic-locked':''}" data-island="${type}" transform="translate(${x} ${y}) scale(${s})" style="--island:${i}">
 <defs><linearGradient id="${prefix}-cliff" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="${sand}"/><stop offset=".55" stop-color="${stone}"/><stop offset="1" stop-color="${ice?'#619eaf':'#806f57'}"/></linearGradient><linearGradient id="${prefix}-grass" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="${ice?'#7bbfca':type==='volcano'?'#96967c':'#62967d'}"/></linearGradient><linearGradient id="${prefix}-sand" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#fff4d7"/><stop offset="1" stop-color="${sand}"/></linearGradient><clipPath id="${prefix}-coast"><path d="${shape}"/></clipPath><clipPath id="${prefix}-rock"><path d="${shape}" transform="translate(0 17)"/></clipPath></defs>
 <path d="${shape}" transform="translate(0 18) scale(1.43 1.58)" fill="#5ebcc026"/>
 <path d="${shape}" transform="translate(0 14) scale(1.23 1.27)" fill="#b4ead563"/>
 <path class="shore-surf" d="${shape}" transform="translate(0 16) scale(1.14 1.12)" fill="none" stroke="#eefff0" stroke-opacity=".56" stroke-width="2.5" stroke-dasharray="39 8 20 15"/>
 <g class="island-float" style="--island:${i}"><path d="${shape}" transform="translate(6 31) scale(1.04 1.02)" fill="#276f7126"/>
 <path d="${shape}" transform="translate(0 17)" fill="url(#${prefix}-cliff)"/>
 <g clip-path="url(#${prefix}-rock)" stroke="#605b4930" stroke-width="2" fill="none"><path d="M-112 12l8 33-5 18m37-44 6 27-4 18m36-39 7 20-3 24m40-48-4 25 7 13m29-30-5 23 8 16m34-39-8 32"/><path d="M-140 36Q-20 75 139 36" stroke="#fff0cb38" stroke-width="2.5"/></g>
 <path d="${shape}" fill="url(#${prefix}-sand)" stroke="${ice?'#e5fff7':'#f5e3b8'}" stroke-width="1.5"/>
 <path d="${shape}" transform="translate(-3 -8) scale(.85 .77)" fill="url(#${prefix}-grass)"/>
 <g clip-path="url(#${prefix}-coast)"><path d="M-112-23Q-38-48 44-31T114-13" fill="none" stroke="#fff9d045" stroke-width="7" stroke-linecap="round"/><path d="M-50 38Q-29 21 8 20t49-23" fill="none" stroke="${sand}" stroke-width="9" stroke-linecap="round" opacity=".68"/><path d="M-41 37q15-4 21-9m7-3 8-1" stroke="#a6986b45" stroke-width="1.5" stroke-dasharray="2 5" fill="none"/>${Array.from({length:11},(_,j)=>`<ellipse cx="${-111+(j*37+i*13)%224}" cy="${21+(j*7+i)%22}" rx="${1+j%3}" ry=".9" fill="#af9a7048"/>`).join('')}</g>
 ${islandEdgeDetails(type,i)}${islandScenery(type)}${coastWildlife(type,i)}
 <path class="shore-glimmer" d="M-87 55q27 8 49 7m48 2q29 0 44-6" fill="none" stroke="#f3ffed" stroke-opacity=".72" stroke-width="2" stroke-linecap="round"/>
 <text class="island-name" y="78" text-anchor="middle" font-size="13" font-weight="bold" fill="#355f60">${name}</text></g></g>`;
}
function expandedWorld(){return `<svg class="world large-world" style="width:${OCEAN_SIZE.width}px;height:${OCEAN_SIZE.height}px" viewBox="0 0 ${OCEAN_SIZE.width} ${OCEAN_SIZE.height}" aria-hidden="true">${islandPaths()}${oceanIslands.map(scenicIsland).join('')}</svg>${oceanDecorations()}`;}
function coastWildlife(type,index){
 if(type==='ice'||type==='volcano')return '';
 const side=index%2?-1:1;
 return `<g class="coast-wildlife" transform="translate(${side*101} 24) scale(.55)"><path d="m-18 8 3-7 4 6 7-2-4 6 3 6-7-1-5 5 1-8Z" fill="#e9b58c"/><path d="M9 9q8-12 15 0Z" fill="#fff0d0" stroke="#c6ad88" stroke-width="1.3"/><path d="m13 8 1-4m3 4V2m3 6-1-4" stroke="#ddc7a0"/>${index%3!==1?`<g class="shore-crab" style="--crab-duration:${30+index%5*3}s;--crab-direction:${index%2?-1:1}"><ellipse cy="3" rx="12" ry="3" fill="#775d4833"/><g class="crab-legs" fill="none" stroke="#b9755c" stroke-width="2" stroke-linecap="round"><path class="crab-feet crab-feet-left" d="m-6 0-8-4-3 4m10 2-8 1-2 4m12-2-6 4"/><path class="crab-feet crab-feet-right" d="m6 0 8-4 3 4m-10 2 8 1 2 4M5 5l6 4"/></g><path d="M-7-2-13-9m20 7 6-7" stroke="#cf8869" stroke-width="3"/><path d="M-14-6q-8-2-5-8l4 3 4-5q6 6-3 10m28 0q8-2 5-8l-4 3-4-5q-6 6 3 10" fill="#df9574"/><ellipse cy="-1" rx="9" ry="6" fill="#e7a27b"/><path d="M-5-4q5-4 10 0" fill="none" stroke="#f6c297" stroke-width="2"/><path d="M-4-6v-4m8 4v-4" stroke="#b7775c" stroke-width="2"/><g fill="#536d60"><circle cx="-4" cy="-10" r="1.5"/><circle cx="4" cy="-10" r="1.5"/></g></g>`:''}</g>`;
}
function marineFish(color='#e9b86d'){
 return `<g class="marine-tail"><path d="M-16 0Q-25-11-29-10l2 10-2 10Q-24 10-16 0Z" fill="${color}"/></g><path d="M-19 0Q-6-17 13-7q17 8 0 15Q-7 17-19 0Z" fill="${color}"/><path d="M-8 8Q3 15 13 6" fill="#fff0c28a"/><path d="m-4-10 8-7 3 9m-7 10 6 9 3-11" fill="${color}"/><path d="M8-5q-4 5 0 10" fill="none" stroke="#6e82725c" stroke-width="1.6"/><circle cx="15" cy="-2" r="2" fill="#365c62"/><circle cx="15.5" cy="-2.5" r=".6" fill="#fff8de"/>`;
}
// Small, bounded habitats share the map's visibility observer; no particle timers.
function marineHabitats(){
 const covePositions=[];
 const coves=oceanIslands.map((island,i)=>{
  let side=i%2?-1:1;
  const y=island.y+(i===0?185:75)*island.scale;
  let x=i===0?island.x-150:island.x+side*190*island.scale-90;
  if(covePositions.some(cove=>Math.abs(x-cove.x)<180&&Math.abs(y-cove.y)<150)){
   side*=-1;x=island.x+side*190*island.scale-90;
  }
  covePositions.push({x,y});
  return `<svg class="marine-cove" style="left:${x}px;top:${y}px;--delay:${-i*1.7}s;--marine-duration:${15+i%5*2}s" viewBox="0 0 180 140"><ellipse cx="94" cy="114" rx="57" ry="12" fill="#429d9730"/><path d="M43 110q13-17 27-3t24 0q25-18 43 6" fill="#9bc5a538"/><g class="marine-kelp" transform="translate(88 108)"><g class="kelp-fronds"><path d="M0 2C-25-20 0-36-20-58Q-4-53-6-30T0 2M4 2Q22-17 13-36t6-28Q12-38 23-26T4 2M-4 2Q-40-10-28-38q-2 19 12 23T-4 2" fill="${island.type==='ice'?'#629e9e99':'#448d7d99'}"/><path d="M-1 0Q5-19 2-42Q17-15-1 0M-10 1Q-16-11-28-14Q-14-20-10 1" fill="#88bd9199"/></g></g><path d="m125 115 3-7 4 6 7-1-5 5 1 7-6-3-6 4 1-7-5-4Z" fill="#d6b18999"/><g transform="translate(42 48) ${i%2?'scale(-1 1)':''}"><g class="cove-swimmer">${marineFish(['#e6b875','#aad0bc','#dca89c'][i%3])}</g></g>${i%2===0?`<g class="marine-bubbles" fill="#e5fff319" stroke="#e5fff3aa" stroke-width="1.3">${[0,1,2].map(j=>`<circle class="marine-bubble" cx="${100+j*11}" cy="${92-j*8}" r="${2.5+j*1.3}" style="--bubble-delay:${-j*2.2-i}s"/>`).join('')}</g>`:''}<g class="cove-foam" fill="none" stroke="#e9fff0" stroke-width="1.7" stroke-linecap="round"><path d="M18 28q12 4 24 0m66 91q17 5 30 0"/></g></svg>`;
 }).join('');
 // Reject island and label areas so large swimmers never pass over the land.
 const openSpot=(index,preferred)=>{
  for(let attempt=0;attempt<60;attempt++){
   const x=attempt===0?preferred[0]:330+(index*829+attempt*677)%(OCEAN_SIZE.width-700);
   const y=attempt===0?preferred[1]:280+(index*571+attempt*433)%(OCEAN_SIZE.height-600);
   if(oceanIslands.every(island=>Math.abs(x-island.x)>island.scale*160+210||Math.abs(y-island.y)>island.scale*170+120))return {x,y};
  }
  return null;
 };
 const sharks=Array.from({length:6},(_,i)=>{
  const spot=openSpot(i,[1140+i*870,540+i*510]);if(!spot)return '';
  return `<svg class="marine-shark" style="left:${spot.x-190}px;top:${spot.y-95}px;--delay:${-i*4.3}s;--marine-duration:${32+i*3}s" viewBox="0 0 380 190"><g transform="translate(${i%2?310:70} 95) scale(${i%2?-1:1} 1)"><g class="shark-swimmer"><ellipse cy="18" rx="68" ry="12" fill="#3b889723"/><g class="shark-tail"><path d="M-48 0Q-64-7-73-29l2 27-8 22Q-60 13-48 0Z" fill="#658f9e"/></g><path d="M-49 0Q-17-28 27-16L55-3q12 4 0 9Q6 29-49 0Z" fill="#7faab3"/><path d="M-37 5Q9 21 54 2Q44 19 8 19Z" fill="#c2d8ca"/><path d="M-15-16Q-11-37 2-40l3 25m-8 26 16 24 1-23" fill="#6398a5"/><path d="M-26-9Q-5-21 19-15" fill="none" stroke="#afd0cb" stroke-width="2" stroke-linecap="round"/><path d="m23-4-2 8m-4-9-2 8" stroke="#558591" stroke-width="1.5"/><circle cx="41" cy="-3" r="2.2" fill="#365d69"/><path d="m44 7 7-1" stroke="#5b8589" stroke-width="1.2" stroke-linecap="round"/></g></g></svg>`;
 }).join('');
 const schools=Array.from({length:8},(_,i)=>{
  const spot=openSpot(i+8,[770+i*680,875+i*410]);if(!spot)return '';
  return `<svg class="marine-school" style="left:${spot.x-145}px;top:${spot.y-65}px;--delay:${-i*3.2}s;--marine-duration:${23+i%4*3}s" viewBox="0 0 290 130"><g transform="translate(${i%2?240:45} 40) scale(${i%2?-1:1} 1)"><g class="school-swimmer">${Array.from({length:6},(_,j)=>`<g transform="translate(${j%3*28} ${Math.floor(j/3)*26+j%2*9}) scale(${.33+j%3*.06})"><g class="school-fish" style="--fish-delay:${-j*.43}s">${marineFish(i%2?'#8bbdb7':'#e5c989')}</g></g>`).join('')}</g></g></svg>`;
 }).join('');
 const currents=Array.from({length:10},(_,i)=>{
  const spot=openSpot(i+20,[760+i*590,740+i*360]);if(!spot)return '';
  return `<svg class="marine-current" style="left:${spot.x-230}px;top:${spot.y-85}px;--delay:${-i*2.8}s" viewBox="0 0 460 170"><g class="current-ribbons" fill="none" stroke-linecap="round"><path d="M10 99C121 151 215 19 441 64" stroke="#d6ffed" stroke-width="1.8"/><path d="M33 116C145 151 224 34 421 82" stroke="#dcfff0" stroke-width="8" opacity=".15"/><path d="M103 126Q163 116 197 95m80-22q39-7 80-2" stroke="#e5fff0" stroke-width="1.2"/></g></svg>`;
 }).join('');
 return currents+coves+schools+sharks;
}
function oceanDecorations(){
 const position=(x,y,i)=>`style="left:${x}px;top:${y}px;--delay:${-i*2.7}s"`;
 const waves=Array.from({length:30},(_,i)=>`<svg class="water-trace" ${position(120+i*877%(OCEAN_SIZE.width-360),170+i*557%(OCEAN_SIZE.height-360),i)} viewBox="0 0 150 55"><path d="M9 21q18 7 36 0m18 0q23 8 46 0M48 39q14 4 28 0"/></svg>`).join('');
 const reefs=oceanIslands.filter((_,i)=>i%2===0).map((island,i)=>`<svg class="submerged-reef" ${position(island.x+190,island.y+140,i)} viewBox="0 0 210 100"><path d="M12 58Q-5 33 49 20T159 20Q211 23 200 55T114 87Q35 106 12 58Z" fill="#318f9130"/><path d="M26 58Q46 24 75 49T123 37Q156 15 180 49L158 73 69 83Z" fill="#7fbd9b55"/><g fill="none" stroke="#438d8666" stroke-width="3" stroke-linecap="round"><path d="M60 71q-16-19-8-31m8 31q8-19 2-29m72 24q-12-20-7-29m7 29q13-13 8-24"/></g><path d="m90 52 13-6 9 10-17 6m61-13 10-6 13 12-20 2" fill="#aad2ab55"/></svg>`).join('');
 const clouds=Array.from({length:10},(_,i)=>`<svg class="map-cloud" ${position(730+i*971%5200,120+i*683%3900,i)} viewBox="0 0 220 115"><ellipse cx="115" cy="97" rx="84" ry="12" fill="#287d8610"/><path d="M32 64C2 62 5 32 37 33 33 8 71 1 86 24 108-4 151 8 153 34 188 18 216 47 193 61 149 76 74 77 32 64Z" fill="#f5fff1b5"/><path d="M30 60Q113 77 195 56" fill="none" stroke="#c9e9dca8" stroke-width="6" stroke-linecap="round"/></svg>`).join('');
 const birds=Array.from({length:9},(_,i)=>`<svg class="map-seabirds" ${position(420+i*739%5400,140+i*463%3800,i)} viewBox="0 0 120 65"><g fill="none" stroke="#f7fff2" stroke-width="3" stroke-linecap="round"><path d="M6 24q12-12 23 0 9-11 22-4M64 43q9-9 17 0 8-8 17-3"/></g></svg>`).join('');
 const shoals=Array.from({length:7},(_,i)=>`<svg class="small-shoal" ${position(760+i*817%5200,880+i*511%3000,i)} viewBox="0 0 130 65"><g fill="#297d8860">${[0,1,2,3].map(j=>`<path transform="translate(${j*25} ${j%2*20})" d="M5 17Q15 7 27 17 15 27 5 17L0 11V23Z"/>`).join('')}</g></svg>`).join('');
 return `<div class="extra-decor" aria-hidden="true">${marineHabitats()}${reefs}${waves}${shoals}${clouds}${birds}<svg class="sailing-boat" style="left:1670px;top:1450px" viewBox="0 0 160 150"><path d="m20 103 123-1-25 28H44Z" fill="#e8b579"/><path d="M81 106V15" stroke="#978d6c" stroke-width="5"/><path class="sail-flutter" d="M74 23 27 94h47zm14 13v58h46z" fill="#fff6d9"/><path d="m81 16 30 9-30 9" fill="#e99588"/></svg><svg class="ocean-whale" style="left:2050px;top:650px" viewBox="0 0 240 150"><path d="M52 80Q36 48 14 50l15 31Q-2 89 9 103l48-7Q78 138 154 126T228 77Q224 29 162 37T52 80" fill="#729eae"/><path d="M83 107q75 34 133-13-21 46-81 34" fill="#b5d4cd"/><circle cx="200" cy="71" r="5" fill="#355b68"/><path class="whale-spout" d="M156 31q-15-33-31-18m31 18q1-40 23-26" stroke="#d8fff1" stroke-width="6" fill="none" stroke-linecap="round"/></svg></div>`;
}
// Each activity room keeps the visual identity of its island on the map.
const islandRoomThemes={
 palms:['#e6f6ed','#eedbab','#245f60','#dc9854','sea','shell','sun','Un ratito bajo las palmeras'],
 lagoon:['#d9f4ee','#9fd5d4','#225d68','#429c96','sea','turtle','shell','Un encuentro bajo el mar'],
 lighthouse:['#dce5f6','#acaed1','#3d496b','#c58c45','sky','star','compass','Sigue la luz de las estrellas'],
 coral:['#f0e2f4','#b1d5df','#665174','#b66e99','sea','fish','shell','Un jardín de colores bajo el agua'],
 waterfall:['#def4e6','#90c8b0','#285f53','#499f80','forest','rainbow','drop','El agua canta entre las montañas'],
 volcano:['#fae9d7','#d4b5a1','#7d5143','#c67550','volcano','cloud','sun','Un volcán con mucho que contar'],
 village:['#e4f4f0','#e5cca3','#41645e','#c48759','sea','boat','bell','¡Bienvenida al puerto!'],
 shell:['#f7e7ef','#cfb9dd','#6d526c','#be7caa','sea','shell','gem','Pequeños tesoros entre las olas'],
 forest:['#e7f0d9','#9ac5a1','#355d47','#789746','forest','butterfly','leaf','El bosque tiene una sorpresa para ti'],
 ship:['#f7edcf','#cbb993','#6e573b','#b78b42','treasure','chest','gem','Sigue las pistas del tesoro'],
 ice:['#e7f5ff','#b8d4e6','#45687f','#749fc5','ice','snow','star','Un mundo que brilla con el hielo'],
 castle:['#fff0d6','#d9c1df','#77526c','#bf8f44','castle','crown','bell','Las puertas del castillo están abiertas'],
 football:['#e2f3ef','#a6cdb6','#285e52','#499b87','sport','ball','trophy','¡La cancha de Messi te espera!'],
 basketball:['#fff0dc','#e1b88f','#815238','#c47d42','court','basketball','trophy','¡Que empiece el partido!'],
 music:['#f1e9fa','#c9b5df','#665084','#aa78b8','music','note','bell','Cada palabra tiene su ritmo'],
 chess:['#edeaf6','#babbd3','#4b4b6f','#8b81b0','chess','pawn','crown','Una nueva jugada por descubrir'],
 dogs:['#f2f3dd','#c6d5a2','#57633e','#b59453','forest','paw','ball','Amigos de cuatro patas te dan la bienvenida'],
 pirates:['#e8e0c8','#8fb9b1','#344e53','#b58a43','treasure','chest','compass','¡A bordo, capitana! El tesoro te espera'],
 haaland:['#def3fa','#9fc9cf','#315e74','#569fb7','sport','ball','trophy','¡Un gol más con Haaland!'],
 school:['#faf0d6','#bbd6c4','#41655c','#d19c4d','school','book','pencil','Ideas nuevas en cada página'],
 kart:['#ebecfa','#b6cbae','#515b7c','#d78261','race','flag','star','¡Enciende motores y descubre la pista!']
};
const islandRoomToyEnglish={
 chest:'Chest',compass:'Compass',shell:'Shell',sun:'Sun',turtle:'Turtle',star:'Star',fish:'Fish',rainbow:'Rainbow',drop:'Water',
 cloud:'Cloud',boat:'Boat',bell:'Bell',gem:'Gem',butterfly:'Butterfly',leaf:'Leaf',snow:'Snowflake',crown:'Crown',ball:'Ball',trophy:'Trophy',
 basketball:'Basketball',note:'Music',pawn:'Pawn',paw:'Paw',book:'Book',pencil:'Pencil',flag:'Flag'
};
const islandRoomToys={
 chest:['Abrir cofre','¡Encontraste el tesoro!','treasure'],compass:['Girar brújula','¡Rumbo a la aventura!','tap'],shell:['Abrir concha','¡Una perla escondida!','bubble'],sun:['Saludar al sol','¡Un rayito de alegría!','mascot'],
 turtle:['Saludar tortuga','¡Tu amiga viene a saludarte!','turtle'],star:['Encender estrella','¡Una estrella para iluminar el camino!','bubble'],fish:['Saludar pez','¡Mira cómo nada!','fish'],rainbow:['Pintar arcoíris','¡Siete colores en el cielo!','combo'],drop:['Tocar el agua','¡Plip, plop!','bubble'],
 cloud:['Soplar nube','¡Una nube que baila con el viento!','bubble'],boat:['Mover barco','¡Soltamos amarras!','travel'],bell:['Tocar campana','¡Ding, dong!','tap'],gem:['Iluminar joya','¡Cuántos colores!','treasure'],butterfly:['Saludar mariposa','¡Abre sus alas para ti!','mascot'],leaf:['Mover hojas','¡Escucha al bosque!','bubble'],
 snow:['Girar copo','¡Cada copo es diferente!','bubble'],crown:['Iluminar corona','¡Una bienvenida real!','treasure'],ball:['Patear pelota','¡Qué gran tiro!','tap'],trophy:['Levantar copa','¡Que viva el equipo!','combo'],basketball:['Botar balón','¡Bota, bota y a la canasta!','tap'],note:['Tocar melodía','¡Do, re, mi!','mascot'],pawn:['Mover pieza','¡Una gran jugada!','tap'],paw:['Saludar perrito','¡Una patita para saludarte!','mascot'],book:['Abrir libro','¡Había una estrella entre las páginas!','flip'],pencil:['Dibujar','¡Una idea llena de color!','tap'],flag:['Agitar bandera','¡Tres, dos, uno… vamos!','combo']
};
function islandRoomDecoyWords(island,config){
 const index=oceanIslands.findIndex(item=>item.type===island.type);
 const realNames=config.slice(5,7).map(kind=>islandRoomToyEnglish[kind].toLocaleLowerCase());
 const choices=islandLessons[index].words.filter(word=>!realNames.includes(word.en.toLocaleLowerCase()));
 const picture=choices[0],wrongLabel=choices.find(word=>word.id!==picture.id);
 return {picture,wrongLabel};
}
function islandRoomToyArt(kind){
 const shapes={
 chest:'<path d="M17 34h66v42H17z" fill="#ae754b"/><path d="M25 36v38m50-38v38" stroke="#f8cf76" stroke-width="7"/><g class="room-toy-reveal" fill="#ffe690"><circle cx="38" cy="30" r="10"/><circle cx="60" cy="27" r="12"/><path d="m50 11 4 9 10 1-8 7 3 11-9-6-9 6 3-11-8-7 10-1Z"/></g><g class="room-toy-lid"><path d="M17 36V25q0-18 18-18h30q18 0 18 18v11Z" fill="#c78e51" stroke="#f5d78c" stroke-width="4"/><rect x="44" y="27" width="13" height="17" rx="3" fill="#ffe09c"/></g>',
 compass:'<circle cx="50" cy="43" r="32" fill="#fff3cd" stroke="#c89951" stroke-width="6"/><path d="M50 16v6m0 43v6M24 43h6m41 0h6" stroke="#8f7351" stroke-width="3"/><g class="room-toy-spin"><path d="m50 19-10 26 10 22 10-26Z" fill="#dc8268"/><path d="m50 43 10-2-10 26Z" fill="#688e9b"/></g><circle cx="50" cy="43" r="4" fill="#fff8df"/>',
 shell:'<ellipse cx="50" cy="62" rx="36" ry="14" fill="#dca6b7"/><g class="room-toy-lid"><path d="M15 48Q2 28 19 17q12-15 23-6Q55-5 67 11q22-5 26 16 5 12-10 24L50 65Z" fill="#efbdcd" stroke="#bf819f" stroke-width="3"/><path d="m50 62-27-39m27 39-6-47m6 47 19-43m-19 43 34-28" stroke="#ffe9e4" stroke-width="4"/></g><circle class="room-toy-reveal" cx="50" cy="54" r="12" fill="#fffbed" stroke="#e3cea5" stroke-width="2"/>',
 sun:'<g class="room-toy-spin" stroke="#e8b45c" stroke-width="5" stroke-linecap="round"><path d="M50 6v9m0 57v9M12 43h9m58 0h9M23 16l7 7m40 40 7 7m0-54-7 7M30 63l-7 7"/><circle cx="50" cy="43" r="24" fill="#f8d77c" stroke="none"/></g><path d="M40 39h1m18 0h1m-17 13q7 6 14 0" stroke="#9b6c3f" stroke-width="3" stroke-linecap="round" fill="none"/>',
 star:'<path class="room-toy-spin" d="m50 7 12 24 27 4-20 19 5 27-24-13-24 13 5-27-20-19 27-4Z" fill="#f6d57a" stroke="#c99c47" stroke-width="3"/><path d="M41 41v5m18-5v5" stroke="#866947" stroke-width="4" stroke-linecap="round"/>',
 turtle:'<g class="room-toy-bounce"><path d="m27 51-10 13m49-13 8 13M30 25l-9-9m44 9 8-8" stroke="#7db584" stroke-width="12" stroke-linecap="round"/><ellipse cx="47" cy="42" rx="29" ry="24" fill="#4a997e"/><path d="m47 25 16 10-6 20H37l-6-20Z" fill="#b2d797"/><circle cx="82" cy="33" r="12" fill="#a4d095"/><circle cx="86" cy="30" r="2" fill="#315c58"/></g>',
 fish:'<g class="room-toy-bounce"><path d="m29 44-20-18v36Z" fill="#e7aa64"/><ellipse cx="56" cy="43" rx="32" ry="24" fill="#f4ca7d"/><path d="M44 23q-9 20 0 39m15-40q-9 20 0 40" stroke="#fff0c7" stroke-width="9" fill="none"/><circle cx="75" cy="38" r="3" fill="#516477"/></g>',
 rainbow:'<g class="room-toy-bounce" fill="none" stroke-width="8"><path d="M14 65a36 36 0 0 1 72 0" stroke="#dd8b89"/><path d="M22 65a28 28 0 0 1 56 0" stroke="#eed27f"/><path d="M30 65a20 20 0 0 1 40 0" stroke="#87bfa8"/><path d="M38 65a12 12 0 0 1 24 0" stroke="#89b5d7"/></g>',
 drop:'<path class="room-toy-bounce" d="M50 8Q9 52 25 69q25 24 50 0Q91 52 50 8Z" fill="#7bbfce" stroke="#4a96a9" stroke-width="3"/><path d="M34 45q-11 19 5 22" stroke="#d7f6ee" stroke-width="6" fill="none" stroke-linecap="round"/>',
 cloud:'<g class="room-toy-bounce"><path d="M20 61Q0 47 20 32q2-28 29-23 24-3 29 23 28 8 8 29Z" fill="#f5f1e8" stroke="#b5cbd0" stroke-width="3"/><path d="M26 74h40m-18 9h33" stroke="#9ebec6" stroke-width="3" stroke-linecap="round"/></g>',
 boat:'<g class="room-toy-bounce"><path d="M12 57h78L74 76H28Z" fill="#ba7b50"/><path d="M50 8v49" stroke="#86664e" stroke-width="4"/><path d="M44 12 17 49h27m12-31 28 31H56" fill="#fff0cc"/></g><path d="M9 81q10-8 20 0t20 0t20 0t20 0" fill="none" stroke="#76b6c4" stroke-width="3"/>',
 bell:'<g class="room-toy-spin"><path d="M24 61q8-12 8-30 0-24 18-24t18 24q0 18 8 30Z" fill="#e8bd64" stroke="#b88741" stroke-width="3"/><circle cx="50" cy="69" r="8" fill="#c58b45"/><path d="M40 24v24" stroke="#fff1b5" stroke-width="5" stroke-linecap="round"/></g>',
 gem:'<path class="room-toy-spin" d="m29 15-17 23 38 42 38-42-17-23Z" fill="#a8bdde" stroke="#6b87b2" stroke-width="3"/><path d="m29 15 8 23 13-23 13 23 8-23M12 38h76M37 38l13 42 13-42" fill="none" stroke="#f2f1fc" stroke-width="3"/>',
 butterfly:'<g class="room-toy-bounce"><path d="M48 40Q5-10 8 35q-4 19 29 18-23 16-11 25 19 10 23-22m4-16Q96-10 93 35q4 19-29 18 23 16 11 25-19 10-23-22" fill="#c6a4d7" stroke="#957bb6" stroke-width="3"/><path d="M50 32v32m0-30-10-12m10 12 10-12" stroke="#6c718b" stroke-width="4" stroke-linecap="round"/></g>',
 leaf:'<g class="room-toy-spin"><path d="M19 70Q-1 13 81 10q13 79-62 60Z" fill="#92bd83" stroke="#5a997a" stroke-width="3"/><path d="m15 77 56-55M32 57l-3-23m15 11 22 3" fill="none" stroke="#d9e9b8" stroke-width="4"/></g>',
 snow:'<g class="room-toy-spin" stroke="#7caabd" stroke-width="4" fill="none" stroke-linecap="round"><path d="M50 8v72M19 26l62 36m-62 0 62-36M40 17l10 9 10-9M40 71l10-9 10 9M20 38l13-3-3-13m40 44-3-13 13-3M20 50l13 3-3 13m40-44-3 13 13 3"/></g>',
 crown:'<g class="room-toy-bounce"><path d="m16 27 18 12L50 15l16 24 18-12-10 43H26Z" fill="#e8bf6a" stroke="#b88b46" stroke-width="3"/><path d="M27 60h46" stroke="#fff0b0" stroke-width="5"/><circle cx="50" cy="47" r="6" fill="#c98590"/></g>',
 ball:'<g class="room-toy-spin"><circle cx="50" cy="43" r="32" fill="#fff9e7" stroke="#8bab9d" stroke-width="3"/><path d="m50 28 14 10-5 17H41l-5-17Z" fill="#526d72"/><path d="m50 11-5 9h10ZM20 31l9 3-4 9Zm5 34 10-6 3 11Zm44 4-6-10 12 4Zm13-36-11 2 5 10Z" fill="#526d72"/></g>',
 trophy:'<g class="room-toy-bounce"><path d="M28 12h44v25q0 23-22 23T28 37Z" fill="#eac779"/><path d="M28 19H14v15q0 16 22 16m36-31h14v15q0 16-22 16M50 60v15m-17 3h34" stroke="#c79548" stroke-width="6" fill="none"/><path d="m50 22 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="#fff3b7"/></g>',
 basketball:'<g class="room-toy-bounce"><circle cx="50" cy="43" r="32" fill="#e5a05e" stroke="#9d704e" stroke-width="3"/><path d="M18 43h64M50 11v64M28 20q36 23 0 47m44-47q-36 23 0 47" stroke="#9d704e" stroke-width="3" fill="none"/></g>',
 note:'<g class="room-toy-bounce" fill="#9981b5"><path d="M38 61V20l41-10v47h-7V25l-27 7v29Z"/><ellipse cx="31" cy="65" rx="15" ry="10"/><ellipse cx="65" cy="61" rx="15" ry="10"/></g>',
 pawn:'<g class="room-toy-bounce" fill="#eee2c7" stroke="#8e88a8" stroke-width="3"><circle cx="50" cy="22" r="15"/><path d="M38 40h24l-3 11 13 23H28l13-23Z"/><path d="M25 78h50" stroke-width="7"/></g>',
 paw:'<g class="room-toy-bounce" fill="#be926c"><ellipse cx="50" cy="57" rx="24" ry="20"/><ellipse cx="20" cy="36" rx="9" ry="13" transform="rotate(-25 20 36)"/><ellipse cx="39" cy="20" rx="9" ry="13"/><ellipse cx="62" cy="20" rx="9" ry="13"/><ellipse cx="81" cy="36" rx="9" ry="13" transform="rotate(25 81 36)"/></g>',
 book:'<path d="M11 22q20-9 39 0 19-9 39 0v53q-19-9-39 0-19-9-39 0Z" fill="#fff3d3" stroke="#6d9b97" stroke-width="4"/><path d="M50 22v53M20 37h20m-20 10h20m20-10h19m-19 10h19" stroke="#c9b58e" stroke-width="3"/><path class="room-toy-reveal" d="m50 5 6 12 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2Z" fill="#edc969"/>',
 pencil:'<g class="room-toy-bounce" transform="rotate(30 50 43)"><path d="M40 15h20v49L50 80 40 64Z" fill="#ecc574" stroke="#b5904d" stroke-width="2"/><path d="M40 15V8h20v7" fill="#dc9794"/><path d="M40 64h20L50 80Z" fill="#eacdab"/><path d="m46 74 4 6 4-6" fill="#597178"/></g><path class="room-toy-reveal" d="M14 78q10-12 20-3t25 0" fill="none" stroke="#8ab1b3" stroke-width="4"/>',
 flag:'<path d="M22 78V9" stroke="#68868b" stroke-width="5"/><g class="room-toy-bounce"><path d="M25 10h57v39H25Z" fill="#fff3d5"/><path d="M25 10h14v13H25m28-13h14v13H53m-14 0h14v13H39m28-13h15v13H67M25 36h14v13H25m28-13h14v13H53" fill="#596480"/></g>'
 };
 return `<svg viewBox="0 0 100 90" aria-hidden="true"><ellipse cx="50" cy="81" rx="32" ry="4" fill="#25464c12"/>${shapes[kind]}</svg>`;
}
function islandRoomLandscape(family){
 const scenes={
 sea:'<path d="M0 590q200-75 400 0t400 0t400 0t400 0v400H0Z" fill="var(--room-ground)"/><g class="room-current" fill="none" stroke="var(--room-accent)" stroke-width="3" opacity=".22"><path d="M-100 640q200-75 400 0t400 0t400 0t400 0M-100 720q200-75 400 0t400 0t400 0t400 0M-100 810q200-75 400 0t400 0t400 0t400 0"/></g>',
 forest:'<path d="M0 570Q160 440 400 650q280-250 550-90t650 30v310H0" fill="var(--room-ground)"/><g fill="var(--room-accent)" opacity=".25"><path d="m-70 670 150-370 150 370Zm1170 10 140-370 140 370Z"/><circle cx="180" cy="540" r="120"/><circle cx="1110" cy="630" r="110"/></g>',
 sky:'<g fill="var(--room-accent)" opacity=".3"><path d="m140 160 8 20 22 2-17 14 5 22-18-12-18 12 5-22-17-14 22-2m970 120 8 20 22 2-17 14 5 22-18-12-18 12 5-22-17-14 22-2"/><circle cx="1200" cy="180" r="70"/></g><path d="M0 770q180-200 410 0 290-130 540 0 220-220 450-40v170H0Z" fill="var(--room-ground)"/>',
 volcano:'<path d="m-130 900 330-520 330 520m330 0 340-600 360 600" fill="var(--room-ground)"/><path d="m1070 530 130-230 140 234-100-54-44 80-56-84Z" fill="#db9a77" opacity=".5"/><g class="room-cloud" fill="#fff5e3" opacity=".65"><circle cx="1200" cy="260" r="55"/><circle cx="1170" cy="200" r="65"/><circle cx="1240" cy="140" r="70"/></g>',
 ice:'<path d="m-160 900 400-540 380 540m140 0 420-680 420 680" fill="var(--room-ground)"/><path d="m98 550 142-190 135 190-90-37-50 50-55-68Zm970-140 112-190 115 190-80-40-35 35-35-43Z" fill="#fbffff"/><g fill="white" opacity=".75"><circle cx="90" cy="170" r="5"/><circle cx="330" cy="330" r="6"/><circle cx="1060" cy="130" r="6"/></g>',
 castle:'<path d="M0 900V610h100V480h35v-30h35v30h40v-30h35v30h35v250h830V470h35v-30h35v30h40v-30h35v30h35v140h100v290Z" fill="var(--room-ground)"/><g fill="var(--room-accent)" opacity=".3"><path d="M142 550h60v85h-60m1030-95h60v85h-60"/></g>',
 sport:'<path d="M0 540h1400v360H0Z" fill="var(--room-ground)"/><g stroke="#f6ffdf" stroke-width="5" opacity=".55" fill="none"><path d="M65 580h1270v270H65Z M700 580v270M65 630h170v170H65m1270-170h-170v170h170"/><ellipse cx="700" cy="715" rx="105" ry="70"/></g>',
 court:'<path d="M0 520h1400v380H0Z" fill="var(--room-ground)"/><g stroke="#fff0d6" stroke-width="5" opacity=".6" fill="none"><path d="M70 570h1260v280H70ZM700 570v280"/><ellipse cx="700" cy="710" rx="100" ry="85"/><path d="M70 605a110 110 0 0 1 0 210m1260-210a110 110 0 0 0 0 210"/></g>',
 music:'<g stroke="var(--room-accent)" opacity=".2" fill="none" stroke-width="3"><path d="M0 620q300-180 700 0t700 0m-1400 25q300-180 700 0t700 0m-1400 25q300-180 700 0t700 0m-1400 25q300-180 700 0t700 0m-1400 25q300-180 700 0t700 0"/></g>',
 school:'<g stroke="var(--room-accent)" opacity=".16" stroke-width="2">'+Array.from({length:18},(_,i)=>`<path d="M0 ${i*50}h1400"/>`).join('')+'<path d="M90 0v900" stroke="#d69187" stroke-width="4"/></g>',
 chess:'<g fill="var(--room-accent)" opacity=".12">'+Array.from({length:42},(_,i)=>`<rect x="${i%14*110}" y="${600+Math.floor(i/14)*110}" width="110" height="110" opacity="${(i%14+Math.floor(i/14))%2?1:0}"/>`).join('')+'</g>',
 race:'<path d="M-80 840Q280 390 700 700t790-140" fill="none" stroke="var(--room-ground)" stroke-width="160"/><path d="M-80 840Q280 390 700 700t790-140" fill="none" stroke="#fff7d8" stroke-width="5" stroke-dasharray="24 24"/>',
 treasure:'<g fill="none" stroke="var(--room-accent)" opacity=".25"><path d="M-50 850Q40 460 190 670t400-30 470 80 390-370" stroke-width="4" stroke-dasharray="10 15"/><circle cx="1200" cy="260" r="95" stroke-width="3"/><path d="m1200 135 26 100 99 25-99 25-26 100-26-100-99-25 99-25Z" stroke-width="3"/><path d="m130 690 45 45m0-45-45 45" stroke-width="9"/></g><path d="M0 850q200-70 400 0t400 0t400 0t400 0v100H0Z" fill="var(--room-ground)"/>'
 };
 return `<svg class="room-landscape" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${scenes[family]}</svg>`;
}
function syncIslandRoom(){
 const dialog=document.querySelector('.screen-overlay');if(!dialog)return;
 const index=screen==='adventure'?adventure?.index:screen==='locked'?lockedIslandIndex:null;
 if(index===null||index===undefined)return;
 const island=oceanIslands[index],config=islandRoomThemes[island.type];if(!config)return;
 if(dialog.dataset.islandRoom!==island.type){
  clearRoomPrize();
  dialog.querySelectorAll('.island-room-backdrop,.island-room-strip').forEach(el=>el.remove());
  dialog.dataset.islandRoom=island.type;dialog.dataset.roomFamily=config[4];
  ['sky','ground','ink','accent'].forEach((name,i)=>dialog.style.setProperty(`--room-${name}`,config[i]));
  dialog.insertAdjacentHTML('afterbegin',`<div class="island-room-backdrop" aria-hidden="true">${islandRoomLandscape(config[4])}<svg class="room-map-art" viewBox="-155 -180 310 250"><ellipse cy="39" rx="136" ry="38" fill="${island.color}"/>${islandScenery(island.type)}</svg><div class="room-motes">${Array.from({length:9},(_,i)=>`<i style="--mote:${i}"></i>`).join('')}</div>`);
  const strip=document.createElement('div');strip.className='island-room-strip';
  const decoy=islandRoomDecoyWords(island,config);
  strip.innerHTML=`<svg class="room-landmark" viewBox="-150 -180 300 250" aria-hidden="true"><ellipse cy="39" rx="136" ry="35" fill="${island.color}"/>${islandScenery(island.type)}</svg><p class="room-welcome">${config[7]}<small>Toca los objetos y gana monedas</small><span class="room-coin-balance">${goldCoinIcon()} <b data-coin-balance>${coinBalance.toLocaleString('es-MX')}</b> monedas</span></p><div class="room-toys" role="group" aria-label="Objetos de ${island.name}">${config.slice(5,7).map(kind=>`<button type="button" class="room-toy" data-island-toy="${kind}" aria-label="${islandRoomToyEnglish[kind]}" aria-pressed="false">${islandRoomToyArt(kind)}<span>${islandRoomToyEnglish[kind]}</span></button>`).join('')}<button type="button" class="room-toy room-toy-decoy" data-room-decoy data-correct-word="${decoy.picture.en}" aria-label="${decoy.wrongLabel.en}"><span class="room-decoy-icon" aria-hidden="true">${decoy.picture.icon}</span><span>${decoy.wrongLabel.en}</span></button></div>`;
  // Shuffle once per island visit, keeping the cards still while playing.
  const toys=strip.querySelector('.room-toys');
  toys.replaceChildren(...shuffle([...toys.children]));
  dialog.querySelector(':scope > header').after(strip);
 }
 syncRoomToyClaims(dialog);syncIslandRoomMotion();syncCoinHud();
}
function syncIslandRoomMotion(){
 const dialog=document.querySelector('[data-island-room]');if(!dialog)return;
 dialog.classList.toggle('room-motionless',calm||matchMedia('(prefers-reduced-motion: reduce)').matches);
 dialog.classList.toggle('room-paused',document.hidden);
}
document.addEventListener('visibilitychange',syncIslandRoomMotion);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',syncIslandRoomMotion);
const ROOM_PRIZE_PREFIX='ximena-room-prize-v1:';
const ROOM_DECOY_PREFIX='ximena-room-decoy-v1:';
let roomPrizeTimer;
function roomPrizeKey(type,kind){return `${ROOM_PRIZE_PREFIX}${type}:${kind}`;}
function readRoomPrize(type,kind){
 try{const value=Number(localStorage.getItem(roomPrizeKey(type,kind)));return [1,2,100].includes(value)?value:0;}catch{return 0;}
}
function roomDecoyKey(type){return `${ROOM_DECOY_PREFIX}${type}`;}
function roomDecoyUsed(type){try{return localStorage.getItem(roomDecoyKey(type))==='1';}catch{return false;}}
function syncRoomToyClaims(dialog=document.querySelector('[data-island-room]')){
 if(!dialog)return;
 dialog.querySelectorAll('[data-island-toy]').forEach(button=>{
  const reward=readRoomPrize(dialog.dataset.islandRoom,button.dataset.islandToy),claimed=reward>0;
  button.disabled=claimed||button.dataset.claiming==='true';
  button.classList.toggle('is-claimed',claimed);button.classList.toggle('is-on',claimed);
  button.classList.toggle('is-jackpot',reward===100);button.setAttribute('aria-pressed',String(claimed));
  button.setAttribute('aria-label',claimed?`${islandRoomToys[button.dataset.islandToy][0]}: premio recogido, ${reward} ${reward===1?'moneda':'monedas'}`:islandRoomToys[button.dataset.islandToy][0]);
  button.querySelector(':scope > span').textContent=islandRoomToyEnglish[button.dataset.islandToy];
 });
 dialog.querySelectorAll('[data-room-decoy]').forEach(button=>{
  const used=roomDecoyUsed(dialog.dataset.islandRoom);
  button.disabled=used||button.dataset.claiming==='true';
  button.classList.toggle('is-decoy-used',used);button.setAttribute('aria-pressed',String(used));
  const label=button.querySelector(':scope > span:last-of-type');
  if(used){
   label.textContent=button.dataset.correctWord;
   if(!button.querySelector('.room-decoy-state')){const state=document.createElement('small');state.className='room-decoy-state';state.textContent='Abierto';button.append(state);}
  }
  button.setAttribute('aria-label',used?`${button.dataset.correctWord}: señuelo abierto, intento utilizado`:label.textContent);
  button.title=used?'Ya abriste este señuelo':'';
 });
}
function clearRoomPrize(){
 clearTimeout(roomPrizeTimer);roomPrizeTimer=null;
 document.querySelectorAll('.room-prize-celebration,.room-penalty-feedback').forEach(el=>{el.getAnimations({subtree:true}).forEach(a=>a.cancel());el.remove();});
}
function showRoomPrize(dialog,reward,saved){
 clearRoomPrize();
 const celebration=document.createElement('div');celebration.className=`room-prize-celebration ${reward===100?'is-jackpot':''}`;celebration.setAttribute('role','status');celebration.setAttribute('aria-live','polite');
 celebration.innerHTML=`<div class="room-prize-rays"></div><div class="room-prize-coins">${Array.from({length:10},(_,i)=>`<i style="--coin:${i}">✦</i>`).join('')}</div><span class="room-prize-coin">${goldCoinIcon()}</span><strong>+${reward}</strong><b>${reward===100?'¡GRAN PREMIO!':reward===1?'¡MONEDA ENCONTRADA!':'¡MONEDAS ENCONTRADAS!'}</b><small>${saved?'Se sumó a tu saldo':'Saldo de esta sesión'}</small>`;
 if(calm||matchMedia('(prefers-reduced-motion: reduce)').matches)celebration.classList.add('is-calm');
 dialog.append(celebration);roomPrizeTimer=setTimeout(clearRoomPrize,2800);
}
function showRoomPenalty(dialog,correct,icon){
 clearRoomPrize();
 const feedback=document.createElement('div');feedback.className='room-penalty-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 feedback.innerHTML=`<div class="room-penalty-rays"></div><div class="room-penalty-sparks" aria-hidden="true">${Array.from({length:8},(_,i)=>`<i style="--spark:${i}">${goldCoinIcon()}</i>`).join('')}</div><span class="room-penalty-coin">${goldCoinIcon()}<b>×</b></span><strong>−50</strong><b>¡OH, NO! ERA UN SEÑUELO</b><div class="room-penalty-correction"><span>${icon}</span><div><small>La palabra correcta es</small><em>${correct}</em></div></div>`;
 if(calm||matchMedia('(prefers-reduced-motion: reduce)').matches)feedback.classList.add('is-calm');
 dialog.append(feedback);roomPrizeTimer=setTimeout(clearRoomPrize,6400);
}
async function openRoomDecoy(button){
 const dialog=button.closest('[data-island-room]');if(!dialog||button.disabled||button.dataset.claiming==='true')return;
 const type=dialog.dataset.islandRoom,correct=button.dataset.correctWord;
 button.dataset.claiming='true';button.disabled=true;
 const open=()=>{
  if(roomDecoyUsed(type))return false;
  try{localStorage.setItem(roomDecoyKey(type),'1');}
  catch{if(dialog.isConnected)announceOcean('No se pudo guardar este intento. No se descontaron monedas.');return false;}
  const saved=spendCoins(50);
  if(dialog.isConnected&&dialog.dataset.islandRoom===type){
   SoundWorld.play('wrong');button.classList.remove('is-wrong');void button.offsetWidth;button.classList.add('is-wrong');showRoomPenalty(dialog,correct,button.querySelector('.room-decoy-icon').textContent);
  }
  return true;
 };
 try{if(navigator.locks?.request)await navigator.locks.request('ximena-room-prizes',open);else open();}
 finally{delete button.dataset.claiming;if(dialog.isConnected)syncRoomToyClaims(dialog);}
}
function islandToyCoinReward(){const roll=Math.random();return roll<.7?1:roll<.9?2:100;}
async function collectRoomPrize(button){
 const dialog=button.closest('[data-island-room]');if(!dialog||button.disabled||button.dataset.claiming==='true')return;
 const type=dialog.dataset.islandRoom,kind=button.dataset.islandToy;
 button.dataset.claiming='true';button.disabled=true;
 const collect=()=>{
  if(readRoomPrize(type,kind))return;
  const reward=islandToyCoinReward();
  // Save the claim before paying, so reopening or reloading cannot pay it again.
  try{localStorage.setItem(roomPrizeKey(type,kind),String(reward));}
  catch{if(dialog.isConnected)announceOcean('No se pudo guardar el premio. Intenta de nuevo.');return;}
  const saved=awardCoins(reward);
  if(!dialog.isConnected||dialog.dataset.islandRoom!==type)return;
  SoundWorld.play(reward===100?'treasure':islandRoomToys[kind][2]);
  showRoomPrize(dialog,reward,saved);
 };
 try{
  if(navigator.locks?.request)await navigator.locks.request('ximena-room-prizes',collect);
  else collect();
 }finally{
  delete button.dataset.claiming;
  if(dialog.isConnected)syncRoomToyClaims(dialog);
 }
}
window.addEventListener('storage',event=>{if(event.key===null||event.key.startsWith(ROOM_PRIZE_PREFIX)||event.key.startsWith(ROOM_DECOY_PREFIX))syncRoomToyClaims();});
document.addEventListener('click',event=>{
 const decoy=event.target.closest('[data-room-decoy]');
 if(decoy&&!document.hidden){
  event.preventDefault();event.stopPropagation();
  void openRoomDecoy(decoy);
  return;
 }
 const button=event.target.closest('[data-island-toy]');if(!button||document.hidden)return;
 event.preventDefault();event.stopPropagation();
 void collectRoomPrize(button);
},true);
