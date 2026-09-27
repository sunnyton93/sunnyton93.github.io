// Salta: world coordinates stay independent of the responsive SVG projection.
const platformCenters=[[300,220],[154,220],[227,94],[373,94],[446,220],[373,346],[227,346]];
const separatedPlatformCenters=platformCenters.map(([x,y])=>[300+(x-300)*1.24,220+(y-220)*1.24]);
const platformColors=['#ffc653','#ff7eaa','#70b8ff','#b69aff','#64dca5','#ff9c62','#59d9e4'];
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
 platformDom={scene,game,tiles:[...scene.querySelectorAll('[data-platform]')].sort((a,b)=>Number(a.dataset.platform)-Number(b.dataset.platform)).map(node=>({node,surface:node.querySelector('.platform-surface'),wake:node.parentElement.querySelector('.platform-wake'),ripple:node.parentElement.querySelector('.platform-weight-ripple')})),
  particles:[...scene.querySelectorAll('.platform-particle')].map(node=>({node,star:node.querySelector('path'),circle:node.querySelector('circle'),item:null,active:node.style.opacity!=='0'})),
  actor:one('.platform-player'),pose:one('.explorer-pose'),shadow:one('.platform-shadow'),splash:one('.platform-splash'),ripple:one('.platform-touch-ring'),halo:one('.platform-landing-ring'),celebration:one('.platform-celebration'),
  clock:one('.platform-countdown'),timeFill:one('.platform-time-fill'),phase:one('.platform-phase'),owl:one('.platform-owl'),jump:one('.platform-jump'),controls:[...game.querySelectorAll('[data-direction]')],joystick:one('[data-platform-joystick]'),thumb:one('.platform-joystick-thumb')};
 platformDom.rig=Object.fromEntries(['body','head','hair','fringe','eyes','brows','smile','arm-left','arm-right','forearm-left','forearm-right','leg-left','leg-right','shin-left','shin-right'].map(part=>[part,one(`.explorer-${part}`)]));
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
function platformWindow(round){return 7000-Math.min(7,round.step)*2000/7;}
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
 p.jumpAt=null;p.z=0;p.gapMs=0;p.last=now;p.fallAt=null;p.walking=false;p.moveX=0;p.moveY=0;p.strength=0;
 p.motionAt=now;p.support=-1;p.contactOffset={x:0,y:0};p.launchOffset={x:0,y:0};
 p.floats ||= platformCenters.map(()=>({depth:0,depthVelocity:0,roll:0,rollVelocity:0,pitch:0,pitchVelocity:0,rippleAt:-Infinity}));
 if(respawn||!p.rig)p.rig={gait:0,run:0,balance:0,lean:0,hair:0,head:0};
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
 p.launchOffset={...p.contactOffset};p.jumpAt=elapsedGameMs(adventure);p.gapMs=0;platformBurst(p,p.jumpAt,p.x,114+p.y*.68,'sand',10);SoundWorld.play('jump');
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
   p.walking=length>0;p.strength=strength;p.moveX=length?dx/length*strength:0;p.moveY=length?dy/length*strength:0;if(Math.abs(dx)>.01)p.facing=dx<0?-1:1;
   if(length){const speed=p.jumpAt===null?185:220;p.x+=dx/length*strength*speed*dt/1000;p.y+=dy/length*strength*speed*dt/1000;}
   if(length&&p.jumpAt===null&&platformAt(p.x,p.y,p.centers)>=0&&now-p.lastTrail>180){platformBurst(p,now,p.x,114+p.y*.68,'sand',2);p.lastTrail=now;}
   p.x=Math.max(30,Math.min(570,p.x));p.y=Math.max(5,Math.min(435,p.y));
   if(p.jumpAt!==null){const t=Math.max(0,Math.min(1,(now-p.jumpAt-55)/595));p.z=256*t*(1-t);if(now-p.jumpAt>=650){p.jumpAt=null;p.z=0;const landingTile=platformAt(p.x,p.y,p.centers);if(landingTile>=0&&!(p.phase==='collapse'&&now-p.phaseAt>=260&&landingTile!==p.safe)){p.landedAt=now;platformBurst(p,now,p.x,114+p.y*.68,'sand',8);}}}
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
// Damped springs use the active game clock, so floating and poses also pause with the game.
function springPlatform(state,key,target,seconds,stiffness=105,damping=14){
 const velocity=`${key}Velocity`,steps=Math.max(1,Math.ceil(seconds*120)),dt=seconds/steps;
 for(let i=0;i<steps;i++){state[velocity]+=(stiffness*(target-state[key])-damping*state[velocity])*dt;state[key]+=state[velocity]*dt;}
}
function platformEdge(p,index){
 if(index<0)return {amount:0,x:0,y:0};
 const dx=p.x-p.centers[index][0],dy=p.y-p.centers[index][1];
 const vertical=79-Math.abs(dx),diagonal=(158-Math.abs(dx)-Math.sqrt(3)*Math.abs(dy))/2;
 const x=vertical<diagonal?Math.sign(dx):Math.sign(dx)*.5,y=vertical<diagonal?0:Math.sign(dy)*Math.sqrt(3)/2;
 // A shared edge is safe while its neighboring platform is above water.
 const neighbor=platformAt(p.x+x*30,p.y+y*30,p.centers);
 const available=neighbor>=0&&neighbor!==index&&(!['collapse','success','fall'].includes(p.phase)||neighbor===p.safe);
 const amount=available?0:Math.max(0,Math.min(1,(28-Math.min(vertical,diagonal))/28));
 return {amount:amount*amount*(3-2*amount),x,y};
}
function updatePlatformMotion(p,now,motion){
 const dt=Math.min(.04,Math.max(0,(now-(p.motionAt??now))/1000));p.motionAt=now;
 const occupied=platformAt(p.x,p.y,p.centers),collapsing=['collapse','success','fall'].includes(p.phase);
 const grounded=p.jumpAt===null&&p.phase!=='fall'&&occupied>=0&&!(collapsing&&occupied!==p.safe&&now-p.phaseAt>=260);
 const support=grounded?occupied:-1,edge=grounded?platformEdge(p,support):{amount:0,x:0,y:0};
 const rig=p.rig,blend=1-Math.exp(-dt*15),speed=p.walking&&grounded?(p.strength||0):0;
 rig.run+=(speed-rig.run)*blend;rig.balance+=(edge.amount-rig.balance)*(1-Math.exp(-dt*20));
 rig.gait+=dt*speed*185/94*Math.PI*2;
 const landed=p.landedAt!==null&&p.lastImpactAt!==p.landedAt;
 if(support>=0&&(support!==p.support||landed)){
  const state=p.floats[support];state.depthVelocity+=landed?42:15;
  state.rollVelocity+=(p.x-p.centers[support][0])*(landed ? .16 : .06);state.rippleAt=now;
 }
 if(landed)p.lastImpactAt=p.landedAt;
 if(p.support>=0&&support!==p.support)p.floats[p.support].rippleAt=now;
 p.support=support;
 let passengerX=0,passengerY=0;
 const surfaces=p.floats.map((state,index)=>{
  const loaded=index===support,dx=loaded?p.x-p.centers[index][0]:0,dy=loaded?p.y-p.centers[index][1]:0;
  springPlatform(state,'depth',loaded?4.8+Math.sin(rig.gait*2)*rig.run*.45:0,dt);
  springPlatform(state,'roll',loaded?dx/79*3.2:0,dt,85,12);
  springPlatform(state,'pitch',loaded?dy/91*1.8:0,dt,85,12);
  const wave=now/1250+index*1.17;
  const lift=motion?Math.sin(wave)*1.65+Math.sin(wave*.71+index)*.65+state.depth:0;
  const roll=motion?Math.sin(wave*.83+index)*.65+state.roll:0;
  const drift=motion?Math.sin(wave*.68+index)*.65:0,scale=motion?1+state.pitch*.008:1;
  if(loaded){const radians=roll*Math.PI/180;passengerX=drift+dx*(Math.cos(radians)-1)-dy*.68*scale*Math.sin(radians);passengerY=lift+dx*Math.sin(radians)+dy*.68*(scale*Math.cos(radians)-1);}
  return {lift,roll,drift,scale,wave,rippleAge:(now-state.rippleAt)/950};
 });
 if(grounded)p.contactOffset={x:passengerX,y:passengerY};
 if(motion&&p.jumpAt!==null){const carry=Math.max(0,1-(now-p.jumpAt)/650);passengerX=p.launchOffset.x*carry;passengerY=p.launchOffset.y*carry;}
 return {surfaces,passengerX,passengerY,edge,dt};
}
function drawPlatformExplorer(view,p,now,motion,state){
 const rig=p.rig,joints=view.rig,jumping=p.jumpAt!==null,falling=p.phase==='fall',happy=p.phase==='success';
 const facing=p.facing<0?-1:1,run=motion?rig.run:0,balance=motion&&!jumping&&!falling&&!happy?rig.balance:0;
 const gait=rig.gait,step=Math.sin(gait),idle=motion?Math.sin(now/650):0;
 const jumpAge=jumping?now-p.jumpAt:0,flight=jumping?Math.max(0,(jumpAge-55)/595):0;
 const anticipation=jumping&&jumpAge<100?Math.sin(jumpAge/100*Math.PI):0;
 const tuck=jumping&&jumpAge>=55?Math.sin(Math.PI*Math.min(1,flight)):0;
 const landingAge=p.landedAt===null?Infinity:now-p.landedAt;
 const landing=motion&&landingAge<450?Math.exp(-landingAge/115)*Math.cos(landingAge/65):0;
 const sway=motion?Math.sin(now/145)*balance:0;
 const targetLean=motion?(run*Math.abs(p.moveX||0)*5-(state.edge.x||0)*facing*balance*8+sway*2+(falling?Math.sin(now/70)*9:0)):0;
 const blend=1-Math.exp(-state.dt*18);
 rig.lean+=(targetLean-rig.lean)*blend;
 rig.head+=((balance?state.edge.x*facing*8:run*step*1.8)-rig.head)*blend;
 rig.hair+=((run*step*5+(jumping?(flight<.5?10:-7):0)-rig.lean*.5+sway*4)-rig.hair)*(1-Math.exp(-state.dt*11));
 rig.joints ||= {};
 const jointBlend=1-Math.exp(-state.dt*30);
 const joint=(name,angle,x,y)=>{
  const previous=rig.joints[name]||0,value=motion?previous+(angle-previous)*jointBlend:0;rig.joints[name]=value;
  platformAttribute(joints[name],'transform',`rotate(${value.toFixed(2)} ${x} ${y})`);
 };
 let leftLeg=step*25*run,rightLeg=-step*25*run,leftKnee=Math.max(0,-step)*32*run,rightKnee=Math.max(0,step)*32*run;
 let leftArm=-step*26*run+idle*2,rightArm=step*26*run-idle*2,leftElbow=-12*run,rightElbow=12*run;
 leftArm=leftArm*(1-balance)+balance*(68+sway*12);rightArm=rightArm*(1-balance)-balance*(68-sway*12);
 leftLeg+=balance*(3+sway*3);rightLeg-=balance*(3-sway*3);
 if(jumping){leftArm=anticipation*14+tuck*105;rightArm=-anticipation*14-tuck*95;leftLeg=-tuck*22+anticipation*12;rightLeg=tuck*25-anticipation*12;leftKnee=tuck*55;rightKnee=-tuck*32;leftElbow=-tuck*22;rightElbow=tuck*25;}
 if(happy){leftArm=145+idle*8;rightArm=-145-idle*8;leftLeg=idle*4;rightLeg=-idle*4;}
 if(falling){leftArm=110+Math.sin(now/65)*28;rightArm=-110+Math.sin(now/65)*28;leftLeg=Math.sin(now/70)*28;rightLeg=-leftLeg;leftKnee=25;rightKnee=-20;}
 leftLeg+=landing*9;rightLeg-=landing*9;
 joint('arm-left',leftArm,-17,-40);joint('arm-right',rightArm,17,-40);
 joint('forearm-left',leftElbow,-23,-30);joint('forearm-right',rightElbow,23,-30);
 joint('leg-left',leftLeg,-9,-21);joint('leg-right',rightLeg,9,-21);
 joint('shin-left',leftKnee,-9,-11);joint('shin-right',rightKnee,9,-11);
 joint('head',rig.head,0,-44);joint('hair',rig.hair,0,-70);joint('fringe',rig.hair*.28,0,-76);
 const compression=motion?landing*.15+anticipation*.12-tuck*.045:0;
 platformAttribute(view.pose,'transform',`scale(${facing*(1+compression)} ${1-compression})`);
 const bob=motion&&!jumping&&!falling?(happy?-Math.abs(idle)*3:-Math.abs(step)*run*1.7+idle*.35*(1-run)):0;
 platformAttribute(joints.body,'transform',`translate(0 ${bob.toFixed(2)}) rotate(${motion?rig.lean.toFixed(2):0} 0 -15)`);
 const blinkTime=now%4300,blink=motion&&blinkTime>3970&&blinkTime<4120?Math.max(.09,Math.abs(blinkTime-4045)/75):1;
 platformAttribute(joints.eyes,'transform',`translate(0 -57) scale(1 ${blink}) translate(0 57)`);
 const worried=balance>.3||falling;
 platformAttribute(joints.smile,'d',worried?'M-3-47q3-4 6 0q-3 4-6 0':happy?'M-5-48q5 10 10 0Z':'M-4-48q4 5 8 0');
 platformAttribute(joints.brows,'d',worried?'M-12-64l7 2m10 0 7-2':'M-12-63q4-3 7-1m10 0q4-2 7 1');
 view.actor.classList.toggle('is-balancing',balance>.2);
 platformAttribute(view.actor,'data-pose',falling?'fall':happy?'celebrate':jumping?(jumpAge<55?'anticipate':flight<.5?'rise':'descend'):landingAge<240?'land':balance>.2?'balance':run>.08?'run':'idle');
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
 const dynamics=updatePlatformMotion(p,now,motion);
 const collapsing=['collapse','success','fall'].includes(p.phase);
 view.tiles.forEach(({node:tile,surface,wake,ripple},index)=>{
  const sunk=collapsing&&index!==p.safe;
  tile.classList.toggle('is-sunk',sunk);tile.classList.toggle('is-safe',collapsing&&index===p.safe);
  tile.classList.toggle('is-standing',p.support===index);
  tile.classList.toggle('is-inspected',p.hovered===index);
  wake.classList.toggle('is-disturbed',sunk);
  const {lift,roll,drift,scale,wave,rippleAge}=dynamics.surfaces[index];
  platformAttribute(surface,'transform',`translate(${drift.toFixed(2)} ${lift.toFixed(2)}) rotate(${roll.toFixed(2)}) scale(1 ${scale.toFixed(4)})`);
  platformAttribute(wake,'rx',84+(motion?Math.sin(wave)*3:0));platformAttribute(wake,'ry',49+(motion?Math.sin(wave)*1.5:0));
  if(motion&&rippleAge>=0&&rippleAge<1){platformAttribute(ripple,'transform',`translate(0 26) scale(${1+rippleAge*.32})`);ripple.style.opacity=(1-rippleAge)*.6;}else ripple.style.opacity=0;

 });
 const elapsed=falling?Math.min(1,(now-p.fallAt)/600):0;
 const actor=view.actor;
 platformAttribute(actor,'transform',`translate(${(p.x+dynamics.passengerX).toFixed(2)} ${(110+p.y*.68-p.z+elapsed*65+dynamics.passengerY).toFixed(2)})`);
 actor.style.opacity=1-elapsed;actor.classList.toggle('is-walking',p.walking&&!falling);actor.classList.toggle('is-jumping',p.jumpAt!==null);actor.classList.toggle('is-celebrating',p.phase==='success');actor.classList.toggle('is-falling',falling);
 const landing=p.landedAt===null?1:Math.min(1,(now-p.landedAt)/220);
 drawPlatformExplorer(view,p,now,motion,dynamics);
 platformAttribute(view.shadow,'rx',Math.max(10,21-p.z/6));
 platformAttribute(view.shadow,'cx',p.x+dynamics.passengerX);platformAttribute(view.shadow,'cy',114+p.y*.68+dynamics.passengerY);
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
function buildplatformExplorer(){return `<g data-static-art="salta-explorer" class="explorer-pose">
 <defs>
 <linearGradient id="salta-girl-hair" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#975d3d"/><stop offset=".45" stop-color="#603b2d"/><stop offset="1" stop-color="#372834"/></linearGradient>
 <radialGradient id="salta-girl-skin" cx=".32" cy=".25" r=".85"><stop stop-color="#fff2df"/><stop offset=".6" stop-color="#f8d5b7"/><stop offset="1" stop-color="#dfa18c"/></radialGradient>
 <linearGradient id="salta-girl-shirt" x2=".45" y2="1"><stop stop-color="#ffffff"/><stop offset=".6" stop-color="#eafaff"/><stop offset="1" stop-color="#9ccce6"/></linearGradient>
 <linearGradient id="salta-girl-shorts" x2=".3" y2="1"><stop stop-color="#4e6584"/><stop offset="1" stop-color="#24374f"/></linearGradient>
 <linearGradient id="salta-girl-shoe" x2=".3" y2="1"><stop stop-color="#57c2de"/><stop offset="1" stop-color="#286b9a"/></linearGradient>
 </defs><g class="explorer-body" stroke-linecap="round" stroke-linejoin="round">
 <g class="explorer-leg explorer-leg-left"><path d="M-9-21v11" fill="none" stroke="#eab99d" stroke-width="8"/>
  <g class="explorer-shin-left"><path d="M-9-11v8" stroke="#ffe3c5" stroke-width="7"/><path d="M-9-8v7" stroke="#f4fcff" stroke-width="8"/><path d="M-13-7h8" stroke="#89cbe8" stroke-width="1.5"/><path d="M-13-3q-7-1-7 6h16V-3Z" fill="url(#salta-girl-shoe)" stroke="#2f5774" stroke-width="1"/><path d="M-19 3h15" stroke="#fffdf3" stroke-width="3"/><path d="m-13-1 5 1" stroke="#ecffff" stroke-width="1.5"/></g>
 </g><g class="explorer-leg explorer-leg-right"><path d="M9-21v11" fill="none" stroke="#eab99d" stroke-width="8"/>
  <g class="explorer-shin-right"><path d="M9-11v8" stroke="#ffe3c5" stroke-width="7"/><path d="M9-8v7" stroke="#f4fcff" stroke-width="8"/><path d="M5-7h8" stroke="#89cbe8" stroke-width="1.5"/><path d="M4-3v6h16q0-6-7-6Z" fill="url(#salta-girl-shoe)" stroke="#2f5774" stroke-width="1"/><path d="M4 3h15" stroke="#fffdf3" stroke-width="3"/><path d="m8 0 5-1" stroke="#ecffff" stroke-width="1.5"/></g>
 </g>
 <path d="M-15-27h30l1 12H3l-3-5-3 5h-13Z" fill="url(#salta-girl-shorts)" stroke="#2b4059" stroke-width="1.3"/><path d="m-12-23-1 7m25-7 1 7" stroke="#d6f4fc" stroke-width="2"/>
 <g class="explorer-arm explorer-arm-left"><path d="m-17-40-6 10" stroke="#eabb9f" stroke-width="8"/><path d="m-16-41-4 6" stroke="url(#salta-girl-shirt)" stroke-width="12"/><path d="m-21-39-2 4" stroke="#63b5e3" stroke-width="3"/>
  <g class="explorer-forearm-left"><path d="m-23-30-1 9" stroke="#f9d7b5" stroke-width="7"/><ellipse cx="-24" cy="-21" rx="4.5" ry="5" fill="url(#salta-girl-skin)"/><path d="m-21-23-1 3" stroke="#daa186" stroke-width="1"/></g>
 </g><g class="explorer-arm explorer-arm-right"><path d="m17-40 6 10" stroke="#eabb9f" stroke-width="8"/><path d="m16-41 4 6" stroke="url(#salta-girl-shirt)" stroke-width="12"/><path d="m21-39 2 4" stroke="#63b5e3" stroke-width="3"/>
  <g class="explorer-forearm-right"><path d="m23-30 1 9" stroke="#f9d7b5" stroke-width="7"/><ellipse cx="24" cy="-21" rx="4.5" ry="5" fill="url(#salta-girl-skin)"/><path d="m21-23 1 3" stroke="#daa186" stroke-width="1"/></g>
 </g>
 <path d="M-7-47h14l11 7-3 16q-15 4-30 0l-3-16Z" fill="url(#salta-girl-shirt)" stroke="#5897bd" stroke-width="1.3"/>
 <path d="M-11-42v17M0-43v20m11-19v17" stroke="#78c8ef" stroke-width="5"/>
 <path d="M-14-26q14 4 28 0" stroke="#4b9acc" stroke-width="1.5" opacity=".6"/>
 <path d="m-7-46 7 7 7-7" fill="#edc1a2" stroke="#345477" stroke-width="2"/><path d="M-14-39v7" stroke="#fff" stroke-width="2"/>
 <text x="0" y="-35" text-anchor="middle" font-family="Arial,sans-serif" font-size="4" font-weight="900" fill="#263f59">MESSI</text><text x="0" y="-25" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="900" fill="#263f59" stroke="#fff" stroke-width=".5" paint-order="stroke">10</text>
 <path d="M9-41h4v4l-2 1-2-1Z" fill="#ffd675" stroke="#c08f41" stroke-width=".7"/>
 <g class="explorer-head">
  <g class="explorer-hair"><path d="M-22-62q-5-25 20-25 28-2 27 27l-2 19 4 9q-11 4-17-6h-22q-8 8-16 2 6-8 6-26Z" fill="url(#salta-girl-hair)" stroke="#533447" stroke-width="1.2"/><path d="M-20-59q-3 17-4 20m43-21q-1 17 3 23" fill="none" stroke="#b87d53" stroke-width="2" opacity=".55"/><path d="M-17-79q12-9 25-1" fill="none" stroke="#e6aa71" stroke-width="2.8" opacity=".4"/></g>
  <ellipse cy="-44" rx="10" ry="3" fill="#82513b" opacity=".14"/>
  <circle cx="-19" cy="-58" r="4.5" fill="#edb99f"/><circle cx="19" cy="-58" r="4.5" fill="#edb99f"/><path d="M-20-59v3m40-3v3" stroke="#d79384" stroke-width="1.2"/>
  <path d="M-20-64q0-19 20-19t20 19v8Q19-41 0-41q-19 0-20-15Z" fill="url(#salta-girl-skin)" stroke="#d6a18a" stroke-width=".8"/>
  <ellipse cx="-12" cy="-51" rx="4.5" ry="2.5" fill="#f09c98" opacity=".52"/><ellipse cx="12" cy="-51" rx="4.5" ry="2.5" fill="#f09c98" opacity=".52"/>
  <path class="explorer-brows" d="M-12-63q4-3 7-1m10 0q4-2 7 1" stroke="#684135" stroke-width="1.6" fill="none"/>
  <g class="explorer-eyes"><ellipse cx="-8" cy="-57" rx="4.3" ry="5.2" fill="#fffdf9"/><ellipse cx="8" cy="-57" rx="4.3" ry="5.2" fill="#fffdf9"/><ellipse cx="-7.5" cy="-56.8" rx="2.9" ry="4" fill="#6c5846"/><ellipse cx="8.5" cy="-56.8" rx="2.9" ry="4" fill="#6c5846"/><ellipse cx="-7" cy="-56.5" rx="1.8" ry="3.1" fill="#303b47"/><ellipse cx="9" cy="-56.5" rx="1.8" ry="3.1" fill="#303b47"/><circle cx="-8" cy="-58.5" r="1.4" fill="#fff"/><circle cx="8" cy="-58.5" r="1.4" fill="#fff"/><path d="m-12-58-1.8-1.5m26 1.5 1.8-1.5" stroke="#634637" stroke-width="1.6"/></g>
  <path d="M-1-55q-2 4 2 3" fill="none" stroke="#d6977e" stroke-width="1.3"/><path d="M-1-54h1" stroke="#fff5e2" stroke-width="1.2"/>
  <path class="explorer-smile" d="M-4-48q4 5 8 0" fill="#fff8ed" stroke="#aa615b" stroke-width="1.5"/>
  <g class="explorer-fringe"><path d="M-22-61q-3-27 22-26 26-1 24 26-11-5-16-18-10 15-30 18Z" fill="url(#salta-girl-hair)"/><path d="M-17-71q8-10 19-10m-15 14q12-3 18-10" fill="none" stroke="#c08758" stroke-width="2.2" opacity=".7"/><path d="M12-78q7 5 9 12" fill="none" stroke="#b47a50" stroke-width="1.7" opacity=".5"/><path d="m-21-69 5-3 3 5-5 3Z" fill="#7bdcf3" stroke="#e9fdff" stroke-width="1"/></g>
 </g></g></g>`;}
function platformScenery(){return platformArtwork.scenery ||= buildplatformScenery();}
function buildplatformScenery(){return `<defs>
 <linearGradient id="salta-sea" x1=".1" y1="0" x2=".7" y2="1"><stop stop-color="#8cebdd"/><stop offset=".36" stop-color="#39c9d1"/><stop offset=".72" stop-color="#269fc0"/><stop offset="1" stop-color="#187da8"/></linearGradient>
 <radialGradient id="salta-depth"><stop stop-color="#175484" stop-opacity=".38"/><stop offset="1" stop-color="#155e8a" stop-opacity="0"/></radialGradient>
 <radialGradient id="salta-shallows"><stop stop-color="#dcffd9" stop-opacity=".75"/><stop offset="1" stop-color="#8bfbe6" stop-opacity="0"/></radialGradient>
 <linearGradient id="salta-light" x2=".35" y2="1"><stop stop-color="#fffde0" stop-opacity=".4"/><stop offset="1" stop-color="#d2fff5" stop-opacity="0"/></linearGradient>
 <linearGradient id="salta-leaf" x2=".5" y2="1"><stop stop-color="#8be2a0"/><stop offset=".45" stop-color="#35af83"/><stop offset="1" stop-color="#187c78"/></linearGradient>
 <pattern id="salta-caustics" width="175" height="120" patternUnits="userSpaceOnUse"><path d="M-15 23q38-20 74 3t57 0 70 1M-20 88q40 17 66-3t64 0 77-5M59 26q-18 28-13 59m70-59q23 28-6 59" fill="none" stroke="#c3fff2" stroke-width="1.6" opacity=".22"/><path d="M5 36q23-9 45 0m68 63q23 6 40-4" fill="none" stroke="#e3fff0" stroke-width="3" opacity=".13"/></pattern>
 </defs><rect width="600" height="425" fill="url(#salta-sea)"/><ellipse cx="70" cy="45" rx="300" ry="170" fill="url(#salta-shallows)"/><ellipse cx="330" cy="295" rx="260" ry="165" fill="url(#salta-depth)"/>
 <g class="platform-sunbeams" fill="url(#salta-light)"><path d="M105 0h82L385 425H175Z"/><path d="M215 0h30L520 425H398Z"/><path d="M310 0h18L600 280v110Z"/></g>
 <g class="platform-underwater" opacity=".55"><path d="M-10 372q27-20 56-1t52 14l-7 50H-10m508 0q-4-42 38-67t70-5v72" fill="#238496"/><ellipse cx="38" cy="407" rx="46" ry="23" fill="#67bcb1"/><ellipse cx="556" cy="417" rx="45" ry="18" fill="#54aaa8"/>
 <g class="platform-kelp" fill="none" stroke-linecap="round"><path d="M22 415q25-32 5-66m2 45q-23-16-17-32m546 55q-20-31 4-68m-7 46q24-9 26-35" stroke="#6dd8b5" stroke-width="8"/><path d="M49 425v-41m0 21-14-10m14 0 13-12m475 42v-26m0 9-11-8m11 0 12-12" stroke="#ffb6a6" stroke-width="6"/></g><path d="m81 398 3 7 8 1-6 5 1 8-7-4-7 4 2-8-6-5 8-1Z" fill="#ffc888"/><ellipse cx="513" cy="413" rx="10" ry="5" fill="#bedcc1"/></g>
 <rect class="platform-caustics" x="-25" y="-25" width="660" height="485" fill="url(#salta-caustics)"/>
 <rect class="platform-caustics platform-caustics-far" x="-25" y="-25" width="660" height="485" fill="url(#salta-caustics)" opacity=".35"/>
 <g class="platform-current" fill="none" stroke-linecap="round"><path d="M-25 150Q70 111 154 151t192 0 280-15M-20 310q111-41 210-8t186-3 240-12" stroke="#d2fff0" stroke-width="14" opacity=".055"/><path d="M-25 143Q70 104 154 144t192 0 280-15M-20 303q111-41 210-8t186-3 240-12" stroke="#d2fff0" stroke-width="1.8" opacity=".19"/></g>
 <g class="platform-fish-school" fill="#177ca1" opacity=".38">${[[32,135],[58,147],[28,162],[509,88],[531,101]].map(([x,y])=>`<path d="M${x} ${y}q10-7 20 0l7-4v8l-7-4q-10 7-20 0"/>`).join('')}</g>
 <g class="platform-waves" fill="none" stroke="#d2fff7" stroke-linecap="round"><path d="M19 93q20 6 39 0m406-50q22 7 44 0M479 370q25 7 49 0M54 330q17 5 33 0M531 213q22 7 42 0" stroke-width="2.6" opacity=".64"/><path d="M27 102q12 3 24 0m485-47 14-1M488 380q15 3 26-1M60 339l16 1M541 223h15" stroke-width="1.3" opacity=".34"/></g>
 <g class="platform-water-glints" fill="#e7fff3">${[[30,193],[95,85],[170,40],[445,60],[562,166],[40,294],[498,335],[118,398],[420,398],[569,304],[374,94],[206,167]].map(([x,y],i)=>`<g class="platform-water-glint" style="--glint-delay:${-i*.73}s"><ellipse cx="${x}" cy="${y}" rx="${i%3+1.6}" ry=".9"/><path d="m${x+6} ${y-6} 1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3Z" opacity=".7"/></g>`).join('')}</g>
 <g class="platform-bubbles" fill="#aef9ee33" stroke="#d0fff6" stroke-width="1" opacity=".6">${[[22,237,3],[575,291,5],[489,49,2],[94,65,3],[557,382,3]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}" style="--bubble:${i}"/>`).join('')}</g>
 <g stroke-linecap="round"><path d="M0 0h91Q54 17 51 43 29 24 0 28Zm600 0h-76q30 13 37 35 15-13 39-14Z" fill="#e8e7b1"/><path d="M0 33q29-6 53 18m508-8q21-21 39-18" fill="none" stroke="#dafff0" stroke-width="3" opacity=".7"/>
 <g fill="url(#salta-leaf)"><path d="M-13-3Q39-12 83 20 28 7 3 24Z"/><path d="M-8 4q54 6 59 61Q21 35-8 27Z"/><path d="M-8 12q27 29 12 76Q-1 60-13 47Z"/><path d="M610-7q-52 0-83 40 43-19 77-12Z"/><path d="M612 5q-47 27-47 69 22-35 46-40Z"/></g><g fill="none" stroke="#b5eec0" stroke-width="1.3" opacity=".55"><path d="M0 3q39 0 65 13M0 14q28 15 43 40M600 6q-33 7-58 22M601 21q-24 14-31 37"/></g></g>`;}
function platformTile(lesson,p,x,y,i){
 const word=lesson.words[p.options[i]],top='M-7-59q7-3 14 0l66 26q6 3 6 9v48q0 6-6 9L7 59q-7 3-14 0l-66-26q-6-3-6-9v-48q0-6 6-9Z';
 return `<g transform="translate(${x} ${110+y*.68})">
 <defs><linearGradient id="salta-stone-${i}" x1="0" y1="0" x2=".25" y2="1"><stop stop-color="${platformColors[i]}"/><stop offset="1" stop-color="#2e6989"/></linearGradient><linearGradient id="salta-face-${i}" x1=".15" y1="0" x2=".75" y2="1"><stop stop-color="#fff4cc"/><stop offset=".25" stop-color="${platformColors[i]}"/><stop offset="1" stop-color="${platformColors[i]}"/></linearGradient><linearGradient id="salta-sheen-${i}" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="salta-tile-clip-${i}"><path d="${top}"/></clipPath></defs>
 <ellipse cy="30" rx="86" ry="51" fill="#11678b" opacity=".13"/><ellipse cy="32" rx="70" ry="40" fill="#135d85" opacity=".13"/>
 <ellipse class="platform-wake" cy="26" rx="84" ry="49" fill="none" stroke="#d6fff3" stroke-width="2"/>
 <g class="platform-weight-ripple" opacity="0" fill="none" stroke="#d6fff5" stroke-width="1.6" pointer-events="none"><ellipse rx="84" ry="49"/><ellipse rx="78" ry="45" opacity=".45"/></g>
 <g data-platform="${i}" class="word-platform" aria-label="${word.en}" style="--tile-color:${platformColors[i]};--tile-delay:${-i*.65}s"><g class="platform-surface">
 <path d="M-79-19 0-48 79-19v60q0 7-7 10L9 77q-9 4-18 0l-63-26q-7-3-7-10Z" fill="url(#salta-stone-${i})" stroke="#326b84" stroke-width="1.5"/>
 <path d="M0 42 78 18v23q0 7-7 10L7 77q-4 2-7 2Z" fill="#245277" opacity=".22"/>
 <path d="m-70 38 55 22q15 7 29 0l56-23" fill="none" stroke="#e6fff0" stroke-width="2.2" opacity=".44"/>
 <path d="m-60 47 10 4m13 5 13 5m51 3 11-5m13-5 9-4" fill="none" stroke="#d0f4e3" stroke-width="3" opacity=".48" stroke-linecap="round"/>
 <path d="m-52 39-2 8 5 8m80-9-3 9 4 7" fill="none" stroke="#2b6480" stroke-width="1.5" opacity=".34"/>
 <path class="platform-top" d="${top}" fill="url(#salta-face-${i})" stroke="#fff6d9" stroke-width="3"/>
 <path d="M-71 26-5 53q5 2 10 0l66-27" fill="none" stroke="#34657d" stroke-width="3" opacity=".17" stroke-linejoin="round"/>
 <path d="M-70-25-4-52q4-2 8 0l64 26" fill="none" stroke="#fffcec" stroke-width="3" stroke-linecap="round" opacity=".9"/>
 <g clip-path="url(#salta-tile-clip-${i})" pointer-events="none"><path d="M-85-5q67-37 172-16v-48H-85Z" fill="#fff" opacity=".09"/><rect class="platform-surface-sheen" x="-150" y="-70" width="70" height="140" fill="url(#salta-sheen-${i})"/></g>
 <g fill="#fffeed" opacity=".5"><ellipse cx="-62" cy="0" rx="2.7" ry="1.4"/><ellipse cx="55" cy="-12" rx="2.2" ry="1.1"/><ellipse cx="-36" cy="-31" rx="2" ry="1"/><ellipse cx="35" cy="36" rx="3" ry="1.3"/></g>
 <path d="m-64 19 6 3m109 9 7-3M-13 45l6 2" fill="none" stroke="#fff7dd" stroke-width="2" stroke-linecap="round" opacity=".48"/>
 <ellipse cy="-28" rx="14" ry="10" fill="#fffbe2" opacity=".68"/><text y="-22" text-anchor="middle" fill="#365a73" opacity=".8" font-size="17">${platformMarks[i]}</text>
 <rect x="-65" y="0" width="130" height="31" rx="13" fill="#fffdf0" opacity=".48"/><path d="M-51 2h102" stroke="#fff" opacity=".4" stroke-linecap="round"/>
 <text class="platform-word" y="22" text-anchor="middle" font-size="${word.en.length>10?16:word.en.length>8?18:21}" font-weight="850" fill="#244668" stroke="#fff9e5" stroke-width="1.5" paint-order="stroke">${word.en}</text>
 <g class="platform-tile-glint" fill="#fffde7"><path d="m-60-30 2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z"/></g>
 </g></g><path class="platform-waterline" d="M-78 46q23 18 57 23m43 0q32-7 55-23" fill="none" stroke="#d9fff2" stroke-width="2.5" stroke-linecap="round" opacity=".65"/></g>`;}

function platformScene(round,lesson){const p=round.platform;return `<svg class="platform-scene" viewBox="0 0 600 ${round.step>=6?450:425}" tabindex="0" role="group" aria-label="Escenario de Salta. Muévete con las flechas o WASD y salta con Espacio."><defs><clipPath id="salta-clip"><rect width="600" height="${round.step>=6?450:425}" rx="28"/></clipPath></defs><g clip-path="url(#salta-clip)"><g class="platform-islands">${p.centers.map(([x,y],i)=>({x,y,i})).sort((a,b)=>a.y-b.y||a.x-b.x).map(({x,y,i})=>platformTile(lesson,p,x,y,i)).join('')}</g><g class="platform-celebration" aria-hidden="true"><ellipse rx="65" ry="42"/><ellipse rx="78" ry="51"/><path d="m-15-78 10 10 22-25"/></g><ellipse class="platform-shadow" cx="300" cy="260" rx="20" ry="8" fill="#173f52" opacity=".26"/><g class="platform-landing-ring" fill="none" stroke="#fff2c3" stroke-width="2" opacity="0"><ellipse rx="22" ry="9"/></g><g class="platform-player" transform="translate(300 259)" aria-label="Tu exploradora">${platformExplorer()}</g><g class="platform-splash" aria-hidden="true"><ellipse rx="37" ry="13"/><ellipse rx="53" ry="21" stroke-width="2"/><path d="M-30 0-45-24M-12-3-20-35M13-3 23-34M30 0 45-21"/></g><g class="platform-touch-ring" opacity="0" fill="none" stroke="#e1fff1" stroke-width="2" pointer-events="none"><ellipse rx="24" ry="12"/><ellipse rx="34" ry="17"/></g><g class="platform-particles" aria-hidden="true" pointer-events="none">${Array.from({length:40},()=>'<g class="platform-particle" opacity="0"><circle r="1"/><path d="M0-1.5.4-.4 1.5 0 .4.4 0 1.5-.4.4-1.5 0-.4-.4Z"/></g>').join('')}</g><g class="platform-sparkles" aria-hidden="true" fill="#fffbd2"><path d="m40 200 3 7 7 3-7 3-3 7-3-7-7-3 7-3m490 88 3 7 7 3-7 3-3 7-3-7-7-3 7-3"/></g></g></svg>`;}
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
