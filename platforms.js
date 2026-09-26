// Salta: world coordinates stay independent of the responsive SVG projection.
const platformCenters=[[300,220],[154,220],[227,94],[373,94],[446,220],[373,346],[227,346]];
const separatedPlatformCenters=platformCenters.map(([x,y])=>[300+(x-300)*1.24,220+(y-220)*1.24]);
const platformColors=['#efb866','#e98d9f','#90b7ed','#ac9ae2','#80c7a1','#ed9b70','#80cbd1'];
const platformMarks=['✦','●','◆','☾','✿','▲','≋'];
const platformKeys=new Set();
const platformPointers=new Map();
const platformJoystick={pointerId:null,x:0,y:0,offsetX:0,offsetY:0};
let platformFrame=null;
let platformDom=null;
let platformArtwork={};
const platformMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');
function invalidatePlatformView(){platformDom=null;}
function getPlatformView(){
 if(platformDom?.scene.isConnected)return platformDom;
 const scene=document.querySelector('.platform-scene');if(!scene)return null;
 const game=scene.closest('.platform-game'),one=selector=>game.querySelector(selector);
 platformDom={scene,game,tiles:[...scene.querySelectorAll('[data-platform]')].map(node=>({node,surface:node.querySelector('.platform-surface'),wake:node.parentElement.querySelector('.platform-wake')})),
  particles:[...scene.querySelectorAll('.platform-particle')].map(node=>({node,star:node.querySelector('path'),circle:node.querySelector('circle'),item:null,active:node.style.opacity!=='0'})),
  actor:one('.platform-player'),pose:one('.explorer-pose'),shadow:one('.platform-shadow'),splash:one('.platform-splash'),ripple:one('.platform-touch-ring'),halo:one('.platform-landing-ring'),celebration:one('.platform-celebration'),
  clock:one('.platform-countdown'),timeFill:one('.platform-time-fill'),phase:one('.platform-phase'),owl:one('.platform-owl'),jump:one('.platform-jump'),controls:[...game.querySelectorAll('[data-direction]')],joystick:one('[data-platform-joystick]'),thumb:one('.platform-joystick-thumb')};
 platformDom.joystickRadius=platformDom.joystick.clientWidth*.3;
 return platformDom;
}
function platformAttribute(node,name,value){const text=String(value);if(node.getAttribute(name)!==text)node.setAttribute(name,text);}
function platformText(node,value){if(node.textContent!==value)node.textContent=value;}
function activePlatforms(){return screen==='adventure'&&adventure?.mode==='platforms'&&adventure.platformStarted&&!adventure.done;}
function clearPlatformControls(){
 platformKeys.clear();platformPointers.clear();
 resetPlatformJoystick();
 document.querySelectorAll('[data-direction]').forEach(button=>button.classList.remove('is-held'));
}
function cancelPlatforms(){cancelAnimationFrame(platformFrame);platformFrame=null;clearPlatformControls();invalidatePlatformView();platformArtwork={};}
function platformAt(x,y,centers=platformCenters){
 // The explorer has feet; compare squared distances without allocating every frame.
 let nearest=-1,distance=Infinity;
 for(let index=0;index<centers.length;index++){
  const [cx,cy]=centers[index],dx=Math.abs(x-cx),dy=Math.abs(y-cy),candidate=dx*dx+dy*dy;
  if(dx<=79&&dx+Math.sqrt(3)*dy<=158&&candidate<distance){nearest=index;distance=candidate;}
 }
 return nearest;
}
function platformWindow(round){return 6000-Math.min(7,round.step)*2000/7;}
function preparePlatforms(round,respawn=false){
 const p=round.platform,now=elapsedGameMs(round),correct=round.order[round.attempt%round.order.length];
 // Move the supporting platform and its passenger together when round five opens the gaps.
 const previousCenters=p.centers||platformCenters,occupiedBefore=platformAt(p.x,p.y,previousCenters);
 p.centers=round.step>=6?separatedPlatformCenters:platformCenters;
 if(respawn){p.x=300;p.y=220;}
 else if(previousCenters!==p.centers&&occupiedBefore>=0){p.x+=p.centers[occupiedBefore][0]-previousCenters[occupiedBefore][0];p.y+=p.centers[occupiedBefore][1]-previousCenters[occupiedBefore][1];}
 const wordIds=islandLessons[round.index].words.map(word=>word.id),previous=p.options;
 p.options=shuffle([correct,...shuffle(wordIds.filter(id=>id!==correct)).slice(0,6)]);
 // Change the answer set as well as its positions on each new clue.
 if(previous&&p.options.every(id=>previous.includes(id))){
  const fresh=wordIds.find(id=>!previous.includes(id));
  if(fresh!==undefined)p.options[p.options.findIndex(id=>id!==correct)]=fresh;
 }
 // Never start a new clue already standing on the answer.
 const occupied=platformAt(p.x,p.y,p.centers),answer=p.options.indexOf(correct);
 if(answer===occupied){const other=(answer+1+Math.floor(Math.random()*6))%7;[p.options[answer],p.options[other]]=[p.options[other],p.options[answer]];}
 p.safe=p.options.indexOf(correct);p.phase='prepare';p.phaseAt=now;p.deadline=now+1100+platformWindow(round);
 p.jumpAt=null;p.z=0;p.gapMs=0;p.last=now;p.fallAt=null;p.walking=false;
 p.particles=[];p.landedAt=null;p.lastTrail=now;p.owlAt=null;p.hovered=-1;p.ripple=null;
 round.notice='';
 render();drawPlatforms(round,now);
}
function beginPlatforms(){
 const round=adventure;
 if(screen!=='adventure'||round?.mode!=='platforms'||round.platformStarted||round.done)return;
 round.platformStarted=true;round.startedAt=performance.now();round.pausedMs=0;round.pausedAt=document.hidden?round.startedAt:null;
 round.platform={x:300,y:220,z:0};
 clearPlatformControls();preparePlatforms(round,true);
 startGameClock();SoundWorld.play('tap');
 platformFrame=requestAnimationFrame(tickPlatforms);
 document.querySelector('.platform-scene')?.focus({preventScroll:true});
}
function jumpPlatforms(){
 if(!activePlatforms()||document.hidden)return;
 const p=adventure.platform;
 if(!['prepare','seek','collapse'].includes(p.phase)||p.jumpAt!==null)return;
 p.jumpAt=elapsedGameMs(adventure);p.gapMs=0;platformBurst(p,p.jumpAt,p.x,114+p.y*.68,'sand',10);SoundWorld.play('jump');
}
function fallPlatforms(round,now){
 const p=round.platform;if(p.phase==='fall')return;
 round.mistakes++;round.streak=0;p.phase='fall';p.phaseAt=now;p.fallAt=now;p.jumpAt=null;
 round.notice=`¡Al agua! La palabra era ${islandLessons[round.index].words[round.order[round.attempt%round.order.length]].en}. ¡Vamos con otra palabra!`;
 clearPlatformControls();platformBurst(p,now,p.x,115+p.y*.68,'water',24);SoundWorld.play('splash');

}
function tickPlatforms(){
 platformFrame=null;if(!activePlatforms()||document.hidden)return;
 const round=adventure,p=round.platform,now=elapsedGameMs(round),dt=Math.min(40,Math.max(0,now-p.last));p.last=now;
 if(!document.hidden){
  if(['prepare','seek','collapse'].includes(p.phase)){
   let right=platformKeys.has('right'),left=platformKeys.has('left'),down=platformKeys.has('down'),up=platformKeys.has('up');
   for(const direction of platformPointers.values()){right ||= direction==='right';left ||= direction==='left';down ||= direction==='down';up ||= direction==='up';}
   const dx=Number(right)-Number(left)+platformJoystick.x,dy=Number(down)-Number(up)+platformJoystick.y,length=Math.hypot(dx,dy);
   const strength=Math.min(1,length);
   p.walking=length>0;p.strength=strength;if(dx)p.facing=dx;
   if(length){const speed=p.jumpAt===null?185:220;p.x+=dx/length*strength*speed*dt/1000;p.y+=dy/length*strength*speed*dt/1000;}
   if(length&&p.jumpAt===null&&now-p.lastTrail>140){platformBurst(p,now,p.x,114+p.y*.68,'sand',2);p.lastTrail=now;}
   p.x=Math.max(30,Math.min(570,p.x));p.y=Math.max(5,Math.min(435,p.y));
   if(p.jumpAt!==null){const t=(now-p.jumpAt)/650;p.z=64*Math.sin(Math.PI*Math.min(1,t));if(t>=1){p.jumpAt=null;p.z=0;p.landedAt=now;if(platformAt(p.x,p.y,p.centers)>=0)platformBurst(p,now,p.x,114+p.y*.68,'sand',8);}}
   const support=platformAt(p.x,p.y,p.centers),sunk=p.phase==='collapse'&&now-p.phaseAt>=260;
   if(p.jumpAt===null&&(support<0||(sunk&&support!==p.safe))){p.gapMs+=dt;if(p.gapMs>(round.step>=6?65:95))fallPlatforms(round,now);}else p.gapMs=0;
   if(p.phase==='prepare'&&now-p.phaseAt>=1100){p.phase='seek';p.phaseAt=now;SoundWorld.play('tap');}
   if(p.phase==='seek'&&now>=p.deadline){p.phase='collapse';p.phaseAt=now;SoundWorld.play('sink');}
   if(p.phase==='collapse'&&now-p.phaseAt>=1100){
    if(support===p.safe&&p.jumpAt===null){p.phase='success';p.phaseAt=now;round.streak++;round.notice='¡A salvo! Encontraste la palabra.';platformBurst(p,now,p.x,80+p.y*.68,'gold',28);SoundWorld.play(round.streak>1?'combo':'correct');}
    // A jump can buy landing time, but can never skip the survival check.
    else if(now-p.phaseAt>1800)fallPlatforms(round,now);
   }
  }else if((p.phase==='fall'&&now-p.phaseAt>=1500)||(p.phase==='success'&&now-p.phaseAt>=800)){
   const survived=p.phase==='success';
   advanceRoundAttempt(round,survived);
   if(round.step===round.target){clearPlatformControls();finishAdventure();render();document.querySelector('[data-play="restart"]')?.focus({preventScroll:true});return;}
   preparePlatforms(round,p.phase==='fall');
  }
 }
 drawPlatforms(round,now);platformFrame=requestAnimationFrame(tickPlatforms);
}
function drawPlatforms(round,now){
 const view=getPlatformView();if(!view)return;
 const {scene,game}=view;
 const p=round.platform,remaining=Math.max(0,p.deadline-now),falling=p.phase==='fall';
 const motion=!calm&&!platformMotionPreference.matches;
 scene.classList.toggle('is-calm',!motion);
 game.classList.toggle('is-paused',document.hidden);game.classList.toggle('is-calm',!motion);
 view.controls.forEach(button=>button.classList.toggle('is-held',platformKeys.has(button.dataset.direction)||[...platformPointers.values()].includes(button.dataset.direction)));
 drawPlatformJoystick();
 const jumping=p.jumpAt!==null;
 const jumpButton=view.jump;jumpButton.classList.toggle('is-recharging',jumping);
 const owl=view.owl;owl.classList.toggle('is-cheering',p.phase==='success'||(p.owlAt!==null&&now-p.owlAt<900));
 if(scene.dataset.phase!==p.phase)scene.dataset.phase=p.phase;scene.classList.toggle('is-urgent',p.phase==='seek'&&remaining<1400);
 const occupied=platformAt(p.x,p.y,p.centers);
 let passengerFloat=0;
 const landingAge=p.landedAt===null?Infinity:now-p.landedAt,landingRipple=landingAge<650?Math.sin(landingAge/75)*Math.exp(-landingAge/230)*2.4:0;
 const collapsing=['collapse','success','fall'].includes(p.phase);
 view.tiles.forEach(({node:tile,surface,wake},index)=>{
  const sunk=collapsing&&index!==p.safe;
  tile.classList.toggle('is-sunk',sunk);tile.classList.toggle('is-safe',collapsing&&index===p.safe);
  tile.classList.toggle('is-standing',occupied===index&&!falling);
  tile.classList.toggle('is-inspected',p.hovered===index);
  wake.classList.toggle('is-disturbed',sunk);
  // Float around fixed collision centers; the passenger follows the same water motion.
  const wave=now/1150+index*.9;
  const lift=motion?Math.sin(wave)*2+Math.sin(wave*.61+index)*.65+(occupied===index?landingRipple:0):0;
  const tilt=motion?Math.sin(wave*.8+index)*.65:0;
  platformAttribute(surface,'transform',`translate(0 ${lift}) rotate(${tilt})`);
  if(index===occupied)passengerFloat=lift+Math.sin(tilt*Math.PI/180)*(p.x-p.centers[index][0]);
  if(motion){platformAttribute(wake,'rx',80+Math.sin(wave)*3);platformAttribute(wake,'ry',47+Math.sin(wave)*1.5);}

 });
 const elapsed=falling?Math.min(1,(now-p.fallAt)/600):0;
 const bob=motion&&p.walking&&p.jumpAt===null&&!falling?Math.sin(now/65)*2.5:0;
 const actor=view.actor;
 platformAttribute(actor,'transform',`translate(${p.x} ${110+p.y*.68-p.z+bob+elapsed*65+(jumping||falling?0:passengerFloat)})`);
 actor.style.opacity=1-elapsed;actor.classList.toggle('is-walking',p.walking&&!falling);actor.classList.toggle('is-jumping',p.jumpAt!==null);actor.classList.toggle('is-celebrating',p.phase==='success');actor.classList.toggle('is-falling',falling);
 actor.style.setProperty('--stride-duration',`${.32-(p.strength||0)*.1}s`);
 const landing=p.landedAt===null?1:Math.min(1,(now-p.landedAt)/220);
 const squash=motion?Math.sin(landing*Math.PI)*.18:0;
 platformAttribute(view.pose,'transform',`scale(${(p.facing<0?-1:1)*(1+squash)} ${1-squash})`);
 actor.style.setProperty('--lean',`${motion&&p.walking?(p.facing<0?-5:5):0}deg`);
 platformAttribute(view.shadow,'rx',Math.max(10,21-p.z/6));
 platformAttribute(view.shadow,'cx',p.x);platformAttribute(view.shadow,'cy',114+p.y*.68);
 view.shadow.style.opacity=falling?0:.26-p.z/400;
 const splash=view.splash;platformAttribute(splash,'transform',`translate(${p.x} ${115+p.y*.68})`);splash.classList.toggle('is-active',falling);
 drawPlatformParticles(scene,p,now,motion);
 const ripple=view.ripple,rippleAge=p.ripple?(now-p.ripple.at)/700:1;
 if(p.ripple)platformAttribute(ripple,'transform',`translate(${p.ripple.x} ${p.ripple.y}) scale(${.3+rippleAge*1.8})`);
 ripple.style.opacity=motion&&rippleAge<1?(1-rippleAge)*.8:0;
 const halo=view.halo;platformAttribute(halo,'transform',`translate(${p.x} ${114+p.y*.68}) scale(${1+landing*1.4})`);halo.style.opacity=motion&&landing<1?(1-landing)*.7:0;
 const celebration=view.celebration;const center=p.centers[p.safe];platformAttribute(celebration,'transform',`translate(${center[0]} ${110+center[1]*.68})`);celebration.classList.toggle('is-active',p.phase==='success');
 const clock=view.clock;
 platformText(clock,p.phase==='prepare'?'Prepárate':p.phase==='seek'?`${(remaining/1000).toFixed(1)} s`:p.phase==='collapse'?'¡Resiste!':p.phase==='success'?'¡Muy bien!':'¡Al agua!');
 view.timeFill.style.transform=`scaleX(${p.phase==='prepare'?1:Math.min(1,remaining/platformWindow(round))})`;
 platformText(view.phase,p.phase==='prepare'?'MIRA LA IMAGEN':p.phase==='seek'?'BUSCA SU PALABRA':p.phase==='collapse'?'¡LAS PLATAFORMAS SE HUNDEN!':p.phase==='success'?'¡PALABRA CONSEGUIDA!':'¡VAMOS OTRA VEZ!');
}
function platformBurst(p,now,x,y,kind,count){
 const colors={water:['#ddfff8','#8be9ef','#ffffff'],sand:['#fff0c2','#f9da93'],gold:['#fff4a2','#ffcb57','#ffffff']};
 p.particles=(p.particles||[]).filter(dot=>now-dot.at<dot.life).slice(-Math.max(0,40-count));
 for(let i=0;i<count;i++){
  const angle=Math.random()*Math.PI*2,speed=kind==='gold'?60+Math.random()*90:25+Math.random()*75;
  p.particles.push({x,y,vx:Math.cos(angle)*speed,vy:-Math.abs(Math.sin(angle)*speed)-(kind==='water'?45:20),at:now,life:kind==='sand'?420:950,size:kind==='sand'?2+Math.random()*2:3+Math.random()*3,color:colors[kind][i%colors[kind].length],kind});
 }
}
function drawPlatformParticles(scene,p,now,motion){
 const view=getPlatformView();if(!view)return;
 view.particles.forEach((entry,i)=>{
  const item=p.particles[i],age=item?(now-item.at)/item.life:1;
  if(!motion||!item||age>=1){if(entry.active){entry.node.style.opacity=0;entry.active=false;}return;}
  const dot=entry.node,seconds=(now-item.at)/1000;
  if(entry.item!==item){
   entry.item=item;dot.setAttribute('fill',item.color);
   entry.star.style.display=item.kind==='gold'?'':'none';entry.circle.style.display=item.kind==='gold'?'none':'';
  }
  entry.active=true;
  dot.setAttribute('transform',`translate(${item.x+item.vx*seconds} ${item.y+item.vy*seconds+90*seconds*seconds}) rotate(${age*150}) scale(${item.size*(1-age*.5)})`);
  dot.style.opacity=Math.min(1,(1-age)*2);
 });
}
function platformOwl(){return platformArtwork.owl ||= buildplatformOwl();}
function buildplatformOwl(){return `<svg data-static-art="salta-owl" viewBox="0 0 80 82" aria-hidden="true"><ellipse cx="40" cy="75" rx="23" ry="4" fill="#31595720"/><g class="owl-body"><path d="M18 26 15 9l19 10h12L65 9l-3 23" fill="#537d79"/><path class="owl-wing owl-wing-left" d="M23 34Q0 33 13 62l15-9" fill="#3e6d70"/><path class="owl-wing owl-wing-right" d="M57 34q23-1 10 28L52 53" fill="#3e6d70"/><rect x="17" y="19" width="46" height="52" rx="23" fill="#7ba593"/><ellipse cx="40" cy="51" rx="18" ry="20" fill="#fff0cc"/><path d="M23 64v9m6-8v8m22-8v8m6-9v9" stroke="#db984d" stroke-width="4" stroke-linecap="round"/><circle cx="28" cy="35" r="14" fill="#fff8e5"/><circle cx="52" cy="35" r="14" fill="#fff8e5"/><g class="owl-eyes"><circle cx="30" cy="35" r="7" fill="#254d55"/><circle cx="50" cy="35" r="7" fill="#254d55"/><circle cx="32" cy="32" r="2.5" fill="white"/><circle cx="52" cy="32" r="2.5" fill="white"/></g><path class="owl-beak" d="m35 44 5-4 5 4-5 8Z" fill="#edaa4e"/><path d="m31 57 3 3m5-3 3 3m5-3 3 3" stroke="#d7b981" stroke-width="2" fill="none"/><path d="M19 20q21-14 42 0" stroke="#c7e5c8" stroke-width="4" fill="none"/></g></svg>`;}
function platformExplorer(){return platformArtwork.explorer ||= buildplatformExplorer();}
function buildplatformExplorer(){return `<g data-static-art="salta-explorer" class="explorer-pose"><defs><linearGradient id="salta-girl-hair" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#754a32"/><stop offset=".5" stop-color="#503324"/><stop offset="1" stop-color="#39271f"/></linearGradient><radialGradient id="salta-girl-skin" cx=".35" cy=".3" r=".8"><stop stop-color="#fff1e3"/><stop offset="1" stop-color="#edc4b0"/></radialGradient></defs><g class="explorer-body"><g class="explorer-hair"><path d="M-18-56Q-22-79-3-81q25-4 25 27l-1 16q0 6 3 10-9 2-14-3L-7-30q-9 7-16 1 5-8 4-16Z" fill="url(#salta-girl-hair)" stroke="#473022" stroke-width="1.2"/><path d="M-16-53q-3 13-3 21m36-22q-2 16 3 22" fill="none" stroke="#986847" stroke-width="2" opacity=".65"/></g><g class="explorer-leg explorer-leg-left"><path d="M-9-18-10-4" stroke="#f3d1bd" stroke-width="7" stroke-linecap="round"/><path d="M-10-10v7" stroke="#f5fcff" stroke-width="8"/><path d="M-10-3h-7" stroke="#346879" stroke-width="8" stroke-linecap="round"/><path d="M-18 0h11" stroke="#e8f9fd" stroke-width="2" stroke-linecap="round"/></g><g class="explorer-leg explorer-leg-right"><path d="M9-18 10-4" stroke="#f3d1bd" stroke-width="7" stroke-linecap="round"/><path d="M10-10v7" stroke="#f5fcff" stroke-width="8"/><path d="M10-3h7" stroke="#346879" stroke-width="8" stroke-linecap="round"/><path d="M7 0h11" stroke="#e8f9fd" stroke-width="2" stroke-linecap="round"/></g><path d="M-15-23h30l-1 10H3v-5h-6v5h-11Z" fill="#294857" stroke="#1f3b48" stroke-width="1.2"/><g class="explorer-arm explorer-arm-left"><path d="M-16-35-24-23" stroke="#f4d3bf" stroke-width="8" stroke-linecap="round"/><path d="M-15-38-21-31" stroke="#f8fdff" stroke-width="10"/><path d="m-17-40-6 7" stroke="#86c9ea" stroke-width="3"/><circle cx="-25" cy="-21" r="4" fill="#f9deca"/></g><g class="explorer-arm explorer-arm-right"><path d="M16-35 24-23" stroke="#f4d3bf" stroke-width="8" stroke-linecap="round"/><path d="M15-38 21-31" stroke="#f8fdff" stroke-width="10"/><path d="m17-40 6 7" stroke="#86c9ea" stroke-width="3"/><circle cx="25" cy="-21" r="4" fill="#f9deca"/></g><path d="M-7-44h14l10 6-3 17h-28l-3-17Z" fill="#f7fcff" stroke="#6ba8c3" stroke-width="1.3"/><path d="M-11-40v18m11-20v20m11-18v18" stroke="#8bcfec" stroke-width="5"/><path d="m-6-44 6 6 6-6" fill="#f7d9c4" stroke="#294857" stroke-width="2" stroke-linejoin="round"/><path d="m-13-27 5 2m13 2 8-3" stroke="#5799b7" stroke-width="1" opacity=".45"/><path d="M-14-38-12-29" stroke="#fff" stroke-width="2" opacity=".8"/><text x="0" y="-33" text-anchor="middle" font-family="Arial,sans-serif" font-size="4.3" font-weight="900" fill="#263f4e">MESSI</text><text x="0" y="-23" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="900" fill="#253f50" stroke="#f7fcff" stroke-width=".5" paint-order="stroke">10</text><path d="M9-38h4v4l-2 1-2-1Z" fill="#e6ba61" stroke="#a17e3d" stroke-width=".6"/><g class="explorer-head"><circle cx="-17" cy="-54" r="4" fill="#f1ccb8"/><circle cx="17" cy="-54" r="4" fill="#f1ccb8"/><ellipse cy="-57" rx="18" ry="20" fill="url(#salta-girl-skin)"/><path d="M-19-55q-4-28 20-25 22 0 19 28-9-7-12-18-9 13-27 15Z" fill="url(#salta-girl-hair)"/><path d="M-15-65q8-11 17-11" fill="none" stroke="#ac7950" stroke-width="2.3" stroke-linecap="round" opacity=".7"/><path d="M-17-59q-2 13 1 20-6-3-6-15m39-5q4 12 1 21 6-5 4-18" fill="url(#salta-girl-hair)"/><path d="M-11-57q4-3 7-1m8 0q4-2 8 1" fill="none" stroke="#694737" stroke-width="1.3" stroke-linecap="round"/><g class="explorer-eyes"><ellipse cx="-7" cy="-53" rx="2.6" ry="3.2" fill="#473c35"/><ellipse cx="7" cy="-53" rx="2.6" ry="3.2" fill="#473c35"/><circle cx="-6" cy="-54" r=".9" fill="white"/><circle cx="8" cy="-54" r=".9" fill="white"/><path d="m-9-54-2-1m20 1 2-1" stroke="#473c35" stroke-width="1.3" stroke-linecap="round"/></g><path d="m0-52-1 5 3 0" fill="none" stroke="#dcae98" stroke-width="1" stroke-linecap="round"/><ellipse cx="-11" cy="-48" rx="3.4" ry="2" fill="#e8a4a0" opacity=".6"/><ellipse cx="11" cy="-48" rx="3.4" ry="2" fill="#e8a4a0" opacity=".6"/><path class="explorer-smile" d="M-4-45q4 5 8 0" stroke="#ad7366" stroke-width="1.7" stroke-linecap="round" fill="#fff7ed"/><path d="m-18-64 3-3 3 3-3 3Z" fill="#9fd9f2" stroke="#eafaff" stroke-width=".8"/></g></g></g>`;}
function platformScenery(){return platformArtwork.scenery ||= buildplatformScenery();}
function buildplatformScenery(){return `<defs>
 <linearGradient id="salta-sea" x2=".25" y2="1"><stop stop-color="#b5f0dc"/><stop offset=".38" stop-color="#63cfc9"/><stop offset="1" stop-color="#20758f"/></linearGradient>
 <radialGradient id="salta-depth"><stop stop-color="#185574" stop-opacity=".45"/><stop offset="1" stop-color="#185574" stop-opacity="0"/></radialGradient>
 <linearGradient id="salta-glaze" x2=".3" y2="1"><stop stop-color="#fffbe3" stop-opacity=".6"/><stop offset=".55" stop-color="#fffbe3" stop-opacity=".05"/><stop offset="1" stop-color="#315d6a" stop-opacity=".2"/></linearGradient>
 <linearGradient id="salta-shirt" x2=".5" y2="1"><stop stop-color="#ffe4a0"/><stop offset="1" stop-color="#eab348"/></linearGradient>
 <linearGradient id="salta-skin"><stop stop-color="#f6cca0"/><stop offset="1" stop-color="#dfa17b"/></linearGradient>
 <linearGradient id="salta-hat" x2=".3" y2="1"><stop stop-color="#80cfb0"/><stop offset="1" stop-color="#3a9690"/></linearGradient>
 <pattern id="salta-caustics" width="130" height="90" patternUnits="userSpaceOnUse"><path d="M-10 25Q25-5 65 22T140 18M5 85q20-50 60-20t70-10M65 22q-20 20 0 43" fill="none" stroke="#d4fff1" stroke-width="1.4" opacity=".26"/></pattern>
 </defs><rect width="600" height="425" rx="28" fill="url(#salta-sea)"/><ellipse cx="300" cy="270" rx="280" ry="165" fill="url(#salta-depth)"/>
 <g class="platform-sunbeams" fill="#e9ffe5" opacity=".13"><path d="M360 0h50L250 425H100Z"/><path d="M448 0h22L360 425h-70Z"/><path d="M505 0h30L500 425h-75Z"/></g>
 <rect class="platform-caustics" x="-20" y="-20" width="640" height="465" fill="url(#salta-caustics)"/>
 <g class="platform-reef" opacity=".65"><path d="M0 370q50-60 86 10l-5 45H0m520 0q-2-74 80-93v93" fill="#216e83"/><path d="M12 415q25-38 0-72m17 57q29-35 16-52m518 68q-16-40 11-81m-3 52q32-7 20-39" fill="none" stroke="#64bcb0" stroke-width="9" stroke-linecap="round"/><path d="M46 418v-30m0 16-15-10m15 1 16-15m477 42v-37m0 22-12-10m12 0 12-16" fill="none" stroke="#eea391" stroke-width="6" stroke-linecap="round"/><ellipse cx="75" cy="414" rx="16" ry="7" fill="#91c7b5"/><ellipse cx="520" cy="417" rx="13" ry="6" fill="#94c9b6"/></g>
 <g class="platform-fish-school" fill="#287f93" opacity=".45">${[[34,140],[55,153],[23,166],[525,55],[549,66]].map(([x,y])=>`<path d="M${x} ${y}q10-8 20 0l8-5v10l-8-5q-10 8-20 0"/>`).join('')}</g>
 <g class="platform-waves" fill="none" stroke="#d4fff2" stroke-width="2" opacity=".6"><path d="M18 90q20 9 40 0m400-50q22 9 44 0M480 389q24 9 48 0M65 355q20 9 40 0M525 180q25 9 50 0"/><ellipse cx="300" cy="260" rx="272" ry="145" stroke-dasharray="50 12 100 18" opacity=".5"/></g>
 <g class="platform-bubbles" fill="none" stroke="#ccfff0" opacity=".55">${[[27,233,4],[572,288,6],[492,45,3],[85,60,5],[557,380,3]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}" style="--bubble:${i}"/>`).join('')}</g>
 <g transform="translate(0 0)" fill="#287c71"><path d="M0 0h112Q73 13 64 44 38 18 0 28Z" fill="#e8d7a0"/><path d="M-10 4Q35-8 85 14 43 8 33 30 17 9-10 4"/><path d="M-5 6Q35 7 47 57 23 32-5 24" fill="#429d82"/><path d="M-5 11Q6 41 3 81L-10 50" fill="#25695f"/><path d="M600 0h-77q39 13 36 45 24-26 41-22Z" fill="#e8d7a0"/><path d="M610 1q-37-3-72 27 42-16 65-6" fill="#43987c"/><path d="M605 7q-45 25-40 66 18-35 44-40"/></g>`;}
function platformTile(lesson,p,x,y,i){const word=lesson.words[p.options[i]];return `<g transform="translate(${x} ${110+y*.68})">
 <ellipse class="platform-wake" cy="24" rx="80" ry="47" fill="none" stroke="#dcfff5" stroke-width="2"/>
 <ellipse cy="35" rx="66" ry="34" fill="#134e6633"/>
 <g data-platform="${i}" class="word-platform" aria-label="${word.en}"><g class="platform-surface">
 <defs><linearGradient id="salta-stone-${i}" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="${platformColors[i]}"/><stop offset="1" stop-color="#517582"/></linearGradient><linearGradient id="salta-face-${i}" x1="0" y1="0" x2=".4" y2="1"><stop stop-color="#fff5d6"/><stop offset=".35" stop-color="${platformColors[i]}"/><stop offset="1" stop-color="${platformColors[i]}"/></linearGradient></defs>
 <path d="M-71-26 0-52 71-26v55q0 9-8 13L7 66q-7 3-14 0l-55-23q-9-4-9-14Z" fill="url(#salta-stone-${i})" stroke="#426576" stroke-width="2"/>
 <path d="M0 40 70 15v18q0 6-8 10L5 68Z" fill="#183e5947"/>
 <path d="m-68 23 18 8-3 14m35-5-3 12 10 6m30-13 11 2 6-9 25-6m-102 1 10-2" fill="none" stroke="#315969" stroke-width="1.8" opacity=".55" stroke-linecap="round"/>
 <path d="m-60 37 9 4m16 7 10 4m51-2 15-6" stroke="#dcf1c0" stroke-width="3" stroke-linecap="round" opacity=".55"/>
 <path class="platform-top" d="M-6-54q6-3 12 0l60 24q5 2 5 8v44q0 6-5 8L6 54q-6 3-12 0l-60-24q-5-2-5-8v-44q0-6 5-8Z" fill="url(#salta-face-${i})" stroke="#fff0c9" stroke-width="3"/>
 <path d="M-62 25 0 50 62 25" fill="none" stroke="#926d573b" stroke-width="3" stroke-linejoin="round"/>
 <path d="M-62-23 0-48 62-23" fill="none" stroke="#fffbe8" stroke-width="3" stroke-linecap="round"/>
 <path d="m-57-19 8 1 8-6m88 45 9-3 2-8M-10 45l9-4 8 2" fill="none" stroke="#667d7466" stroke-width="1.2" stroke-linecap="round"/>
 <g fill="#edffe0" opacity=".45"><ellipse cx="-51" cy="11" rx="3" ry="1.5"/><ellipse cx="48" cy="-11" rx="2" ry="1"/><ellipse cx="-28" cy="-30" rx="2" ry="1"/><ellipse cx="27" cy="34" rx="3" ry="1.2"/></g>
 <path d="M-68 22q7-2 9 3m111 5q6-5 13-4" fill="none" stroke="#83a77c" stroke-width="4" stroke-linecap="round" opacity=".8"/>
 <ellipse cy="-22" rx="15" ry="11" fill="#fff8df" opacity=".5"/><text y="-16" text-anchor="middle" fill="#345a64" opacity=".7" font-size="18">${platformMarks[i]}</text>
 <text class="platform-word" y="19" text-anchor="middle" font-size="${word.en.length>10?17:22}" font-weight="800" fill="#243f51" stroke="#fff5d1" stroke-width="2" paint-order="stroke">${word.en}</text>
 <g class="platform-tile-glint" fill="#fffde4"><path d="m-54-29 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></g>
 </g></g><path class="platform-waterline" d="M-67 42q22 16 49 18m38 0q25-3 46-17" fill="none" stroke="#d5fff1" stroke-width="2" stroke-linecap="round" opacity=".5"/></g>`;}

function platformScene(round,lesson){const p=round.platform;return `<svg class="platform-scene" viewBox="0 0 600 ${round.step>=6?450:425}" tabindex="0" role="group" aria-label="Escenario de Salta. Muévete con las flechas o WASD y salta con Espacio."><defs><clipPath id="salta-clip"><rect width="600" height="${round.step>=6?450:425}" rx="28"/></clipPath></defs><g clip-path="url(#salta-clip)"><g class="platform-islands">${p.centers.map(([x,y],i)=>platformTile(lesson,p,x,y,i)).join('')}</g><g class="platform-celebration" aria-hidden="true"><ellipse rx="65" ry="42"/><ellipse rx="78" ry="51"/><path d="m-15-78 10 10 22-25"/></g><ellipse class="platform-shadow" cx="300" cy="260" rx="20" ry="8" fill="#173f52" opacity=".26"/><g class="platform-landing-ring" fill="none" stroke="#fff2c3" stroke-width="2" opacity="0"><ellipse rx="22" ry="9"/></g><g class="platform-player" transform="translate(300 259)" aria-label="Tu exploradora">${platformExplorer()}</g><g class="platform-splash" aria-hidden="true"><ellipse rx="37" ry="13"/><ellipse rx="53" ry="21" stroke-width="2"/><path d="M-30 0-45-24M-12-3-20-35M13-3 23-34M30 0 45-21"/></g><g class="platform-touch-ring" opacity="0" fill="none" stroke="#e1fff1" stroke-width="2" pointer-events="none"><ellipse rx="24" ry="12"/><ellipse rx="34" ry="17"/></g><g class="platform-particles" aria-hidden="true" pointer-events="none">${Array.from({length:40},()=>'<g class="platform-particle" opacity="0"><circle r="1"/><path d="M0-1.5.4-.4 1.5 0 .4.4 0 1.5-.4.4-1.5 0-.4-.4Z"/></g>').join('')}</g><g class="platform-sparkles" aria-hidden="true" fill="#fffbd2"><path d="m40 200 3 7 7 3-7 3-3 7-3-7-7-3 7-3m490 88 3 7 7 3-7 3-3 7-3-7-7-3 7-3"/></g></g></svg>`;}
function platformView(round,lesson){
 if(!round.platformStarted)return `<div class="archery-intro platform-intro"><div class="platform-intro-art" aria-hidden="true"><span>${platformOwl()}</span></div><h2>¡Que no te lleve la marea!</h2><button class="primary" data-play="platform-start">¡A saltar! <span aria-hidden="true">➜</span></button></div>`;
 const p=round.platform,word=lesson.words[round.order[round.attempt%round.order.length]];
 return `<div class="platform-game"><div class="platform-play-area"><div class="platform-controls platform-joystick-side"><div class="platform-joystick" data-platform-joystick tabindex="0" role="group" aria-label="Joystick para mover a la exploradora" aria-describedby="platform-joystick-help"><span class="platform-joystick-track" aria-hidden="true"></span><span class="platform-joystick-thumb" aria-hidden="true"></span></div><span class="platform-control-hint" id="platform-joystick-help">Mantén y arrastra</span></div><div class="platform-stage"><svg data-static-art="salta-water" class="platform-water-backdrop" viewBox="0 0 600 425" preserveAspectRatio="none" aria-hidden="true">${platformScenery()}</svg>${platformScene(round,lesson)}<div class="platform-host scene-clue"><div class="platform-clue"><div><span role="img" aria-label="${word.es}">${word.icon}</span><b>${word.es}</b></div></div></div><span class="scene-score platform-score" aria-label="${round.step} aciertos de ${round.target}">★ ${round.step}/${round.target}</span><button class="platform-owl" type="button" aria-label="Saludar a Oli">${platformOwl()}</button><div class="platform-timing"><span class="platform-timer-label" aria-hidden="true">◷ TIEMPO</span><strong class="platform-countdown" aria-label="Tiempo para llegar">Prepárate</strong><div class="platform-time"><i class="platform-time-fill"></i></div></div><small class="platform-phase game-announcement">MIRA LA IMAGEN</small></div><div class="platform-controls platform-jump-side"><button class="platform-jump" data-play="platform-control" data-direction="jump"><span aria-hidden="true">↟</span> Saltar</button></div></div></div>`;
}
function resetPlatformJoystick(){
 const id=platformJoystick.pointerId;
 Object.assign(platformJoystick,{pointerId:null,x:0,y:0,offsetX:0,offsetY:0});
 const control=document.querySelector('[data-platform-joystick]');
 if(id!==null&&control?.hasPointerCapture(id))control.releasePointerCapture(id);
 drawPlatformJoystick();
}
function movePlatformJoystick(event,control){
 const box=control.getBoundingClientRect(),radius=box.width*.3;
 const dx=event.clientX-(box.x+box.width/2),dy=event.clientY-(box.y+box.height/2),distance=Math.hypot(dx,dy);
 const travel=Math.min(distance,radius),strength=Math.max(0,(travel/radius-.12)/.88);
 platformJoystick.x=distance?dx/distance*strength:0;platformJoystick.y=distance?dy/distance*strength:0;
 platformJoystick.offsetX=distance?dx/distance*travel:0;platformJoystick.offsetY=distance?dy/distance*travel:0;
 drawPlatformJoystick();
}
function drawPlatformJoystick(){
 const view=getPlatformView();if(!view)return;
 const control=view.joystick;
 const held=platformJoystick.pointerId!==null;
 const dx=Number(platformKeys.has('right'))-Number(platformKeys.has('left')),dy=Number(platformKeys.has('down'))-Number(platformKeys.has('up')),length=Math.hypot(dx,dy);
 const radius=view.joystickRadius;
 const x=held?platformJoystick.offsetX:(length?dx/length*radius:0),y=held?platformJoystick.offsetY:(length?dy/length*radius:0);
 control.classList.toggle('is-held',held||length>0);
 if(view.thumbX!==x||view.thumbY!==y){view.thumb.style.transform=`translate(${x}px,${y}px)`;view.thumbX=x;view.thumbY=y;}
}
document.addEventListener('pointerdown',event=>{
 const control=event.target.closest('[data-platform-joystick]');
 if(!control||!activePlatforms()||document.hidden||event.button!==0||platformJoystick.pointerId!==null)return;
 event.preventDefault();platformJoystick.pointerId=event.pointerId;control.setPointerCapture(event.pointerId);movePlatformJoystick(event,control);
});
document.addEventListener('pointermove',event=>{
 if(event.pointerId!==platformJoystick.pointerId)return;
 const control=document.querySelector('[data-platform-joystick]');
 if(!control||!activePlatforms()||document.hidden){resetPlatformJoystick();return;}
 event.preventDefault();movePlatformJoystick(event,control);
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{
 if(event.pointerId===platformJoystick.pointerId)resetPlatformJoystick();
});
window.addEventListener('resize',()=>{clearPlatformControls();invalidatePlatformView();});
const platformKeyMap={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
document.addEventListener('keydown',event=>{
 if(!activePlatforms()||event.ctrlKey||event.metaKey||event.altKey)return;
 const direction=platformKeyMap[event.key]||platformKeyMap[event.key.toLowerCase()];
 if(direction){event.preventDefault();platformKeys.add(direction);}
 if(event.code==='Space'&&(!event.target.closest('button')||event.target.closest('[data-direction]'))){event.preventDefault();if(!event.repeat)jumpPlatforms();}
});
document.addEventListener('keyup',event=>{const direction=platformKeyMap[event.key]||platformKeyMap[event.key.toLowerCase()];if(direction)platformKeys.delete(direction);});
document.addEventListener('pointerdown',event=>{
 const button=event.target.closest('[data-direction]');if(!button||!activePlatforms()||event.button!==0)return;
 event.preventDefault();button.setPointerCapture(event.pointerId);button.classList.add('is-held');
 platformPointers.set(event.pointerId,button.dataset.direction);if(button.dataset.direction==='jump')jumpPlatforms();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{
 const direction=platformPointers.get(event.pointerId);platformPointers.delete(event.pointerId);
 if(![...platformPointers.values()].includes(direction))document.querySelector(`[data-direction="${direction}"]`)?.classList.remove('is-held');
});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-direction]');if(!button)return;
 event.preventDefault();event.stopPropagation();
 if(event.detail===0&&button.dataset.direction==='jump')jumpPlatforms();
},true);
window.addEventListener('blur',clearPlatformControls);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){clearPlatformControls();cancelAnimationFrame(platformFrame);platformFrame=null;}
 else if(activePlatforms()&&platformFrame===null){adventure.platform.last=elapsedGameMs(adventure);platformFrame=requestAnimationFrame(tickPlatforms);}
});

// Decorative interactions never change the answer, timer or score.
document.addEventListener('click',event=>{
 if(!activePlatforms()||document.hidden)return;
 const owl=event.target.closest('.platform-owl'),scene=event.target.closest('.platform-scene');
 const p=adventure.platform,now=elapsedGameMs(adventure);
 if(owl){p.owlAt=now;SoundWorld.play('mascot');return;}
 if(!scene||p.phase==='fall')return;
 const matrix=scene.getScreenCTM();if(!matrix)return;
 const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
 p.ripple={x:point.x,y:point.y,at:now};
 platformBurst(p,now,point.x,point.y,event.target.closest('[data-platform]')?'sand':'water',12);SoundWorld.play('bubble');
});
document.addEventListener('pointermove',event=>{
 if(!activePlatforms())return;
 const tile=event.target.closest('[data-platform]');adventure.platform.hovered=tile?Number(tile.dataset.platform):-1;
});
