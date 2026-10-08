// Four soft, axis-aligned ellipses. Physics runs in fixed steps; DOM writes run
// once per frame. The arrow's existing aim/hit rules remain in games.js.
const ARCHERY_PHYSICS_STEP=1/120;
const ARCHERY_RESTITUTION=.88;
const ARCHERY_BALLOON_GAP=6;
let archeryMotion=null,archeryMotionFrame=null;
const archeryMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');
function archeryMotionLevel(attempt){return Math.min(6,Math.max(0,attempt-5));}
function archeryMotionSettings(attempt,width,height){
 const level=archeryMotionLevel(attempt);
 const baseSpeed=Math.max(34,Math.min(52,Math.min(width,height)*.13));
 // The first six attempts are gentle practice. From attempt seven, the same
 // continuous simulation eases up to the full speed and stronger currents.
 return {level,speed:baseSpeed*(level===0?.3:1+.04*level),turnRate:level===0?.1:.5+.05*level};
}
// Per-balloon randomness keeps currents independent of frame rate. Nothing pulls
// a balloon back to its starting point or gives it a repeating orbital path.
function archeryCurrentRandom(body){
 let seed=body.randomSeed||1;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
 body.randomSeed=seed>>>0;return body.randomSeed/4294967296;
}
function archeryContact(state,body,nx,ny,speed){
 if(speed<2||state.time-(body.lastImpact??-1)<.11)return;
 body.lastImpact=state.time;state.onImpact?.(body,nx,ny,speed);
}
function bounceArcheryWalls(state,body){
 const bounds={left:8+body.rx,right:state.width-8-body.rx,top:8+body.ry,bottom:state.height-8-body.ry};
 for(const [axis,velocity,low,high,nx,ny] of [['x','vx',bounds.left,bounds.right,1,0],['y','vy',bounds.top,bounds.bottom,0,1]]){
  if(body[axis]<low){
   body[axis]=low;
   if(body[velocity]<0){const speed=-body[velocity];body[velocity]*=-ARCHERY_RESTITUTION;archeryContact(state,body,nx,ny,speed);}
  }else if(body[axis]>high){
   body[axis]=high;
   if(body[velocity]>0){const speed=body[velocity];body[velocity]*=-ARCHERY_RESTITUTION;archeryContact(state,body,-nx,-ny,speed);}
  }
 }
}
function collideArcheryBalloons(state,a,b){
 if(a.active===false||b.active===false)return;
 let dx=b.x-a.x,dy=b.y-a.y;
 const rx=a.rx+b.rx+ARCHERY_BALLOON_GAP,ry=a.ry+b.ry+ARCHERY_BALLOON_GAP;
 let overlap=dx*dx/(rx*rx)+dy*dy/(ry*ry);
 if(overlap>=1)return;
 // Coincident centers have a deterministic separating direction, never NaN.
 if(dx===0&&dy===0){dx=.001;overlap=dx*dx/(rx*rx);}
 const length=Math.hypot(dx/(rx*rx),dy/(ry*ry)),nx=dx/(rx*rx)/length,ny=dy/(ry*ry)/length;
 const inverseA=1/a.mass,inverseB=1/b.mass,inverseSum=inverseA+inverseB;
 // Move along the ellipse contact normal until the envelopes no longer overlap.
 const qa=(nx/rx)**2+(ny/ry)**2,qb=2*(dx*nx/(rx*rx)+dy*ny/(ry*ry));
 const separation=(-qb+Math.sqrt(qb*qb+4*qa*(1-overlap)))/(2*qa)+.001;
 a.x-=nx*separation*inverseA/inverseSum;a.y-=ny*separation*inverseA/inverseSum;
 b.x+=nx*separation*inverseB/inverseSum;b.y+=ny*separation*inverseB/inverseSum;
 const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
 // Separating contacts need position correction only; do not bounce them twice.
 if(closing>=0)return;
 const impulse=-(1+ARCHERY_RESTITUTION)*closing/inverseSum;
 a.vx-=impulse*nx*inverseA;a.vy-=impulse*ny*inverseA;
 b.vx+=impulse*nx*inverseB;b.vy+=impulse*ny*inverseB;
 archeryContact(state,a,nx,ny,-closing);archeryContact(state,b,-nx,-ny,-closing);
}
function archeryObstacleContact(body,box){
 const x=Math.max(box.left,Math.min(box.right,body.x)),y=Math.max(box.top,Math.min(box.bottom,body.y));
 const dx=body.x-x,dy=body.y-y,rx=body.rx+6,ry=body.ry+6;
 const distance=Math.hypot(dx/rx,dy/ry);
 if(distance>=1)return null;
 if(distance===0){
  const exits=[{x:box.left-rx-body.x,y:0},{x:box.right+rx-body.x,y:0},{x:0,y:box.top-ry-body.y},{x:0,y:box.bottom+ry-body.y}];
  const push=exits.reduce((a,b)=>Math.hypot(a.x,a.y)<Math.hypot(b.x,b.y)?a:b);
  return {...push,nx:Math.sign(push.x),ny:Math.sign(push.y)};
 }
 const normal=Math.hypot(dx/(rx*rx),dy/(ry*ry));
 return {x:dx*(1/distance-1),y:dy*(1/distance-1),nx:dx/(rx*rx)/normal,ny:dy/(ry*ry)/normal};
}
function keepArcheryControlsClear(state,body){
 for(const box of state.obstacles||[]){
  const contact=archeryObstacleContact(body,box);if(!contact)continue;
  body.x+=contact.x;body.y+=contact.y;
  const closing=body.vx*contact.nx+body.vy*contact.ny;
  if(closing<0){body.vx-=(1+ARCHERY_RESTITUTION)*closing*contact.nx;body.vy-=(1+ARCHERY_RESTITUTION)*closing*contact.ny;}
 }
}
function stepArcheryPhysics(state,dt){
 state.time+=dt;
 for(const body of state.bodies){
  if(body.active===false)continue;
  // Change the current at irregular intervals, then ease toward it. Collisions
  // can reverse direction immediately; wind bends the trajectory smoothly.
  if(state.time>=(body.nextCurrentAt??0)){
   body.currentTarget=archeryCurrentRandom(body)*2-1;
   body.nextCurrentAt=state.time+1.1+archeryCurrentRandom(body)*1.8;
  }
  body.currentTurn=(body.currentTurn||0)+(body.currentTarget-(body.currentTurn||0))*(1-Math.exp(-2*dt));
  const turn=state.settings.turnRate*body.currentTurn*dt;
  const cosine=Math.cos(turn),sine=Math.sin(turn),vx=body.vx*cosine-body.vy*sine,vy=body.vx*sine+body.vy*cosine;
  const speed=Math.hypot(vx,vy),desired=state.settings.speed*body.pace;
  const nextSpeed=speed+(desired-speed)*Math.min(1,dt*.7);
  body.vx=speed?vx*nextSpeed/speed:desired;body.vy=speed?vy*nextSpeed/speed:0;
  body.x+=body.vx*dt;body.y+=body.vy*dt;
 }
 // Iteration also resolves multiple contacts in a corner without sticking.
 for(let pass=0;pass<6;pass++){
  for(const body of state.bodies)if(body.active!==false){keepArcheryControlsClear(state,body);bounceArcheryWalls(state,body);}
  for(let i=0;i<state.bodies.length;i++)for(let j=i+1;j<state.bodies.length;j++)collideArcheryBalloons(state,state.bodies[i],state.bodies[j]);
 }
 for(const body of state.bodies){
  if(body.active===false)continue;
  bounceArcheryWalls(state,body);
  const speed=Math.hypot(body.vx,body.vy),limit=state.settings.speed*1.35;
  if(speed>limit){body.vx*=limit/speed;body.vy*=limit/speed;}
 }
}
function advanceArcheryPhysics(state,seconds){
 // Discard large frame gaps, rather than teleporting after a stalled/hidden tab.
 state.accumulator+=Math.min(.05,Math.max(0,seconds));
 while(state.accumulator+1e-9>=ARCHERY_PHYSICS_STEP){stepArcheryPhysics(state,ARCHERY_PHYSICS_STEP);state.accumulator=Math.max(0,state.accumulator-ARCHERY_PHYSICS_STEP);}
}
function archeryMotionCanRun(){
 return archeryMotion&&archeryMotion.round===adventure&&screen==='adventure'&&archeryMotion.layer.isConnected&&
  !adventure.done&&adventure.pausedAt===null&&!document.hidden&&
  !document.documentElement.dataset.inactivityDialog&&!calm&&!archeryMotionPreference.matches;
}
function animateArcheryContact(body,nx,ny,speed){
 if(!archeryMotionCanRun())return;
 body.impact?.cancel();
 const strength=Math.min(.1,.025+speed/900),angle=Math.atan2(ny,nx)*180/Math.PI;
 const squash=(x,y)=>`rotate(${angle}deg) scale(${x},${y}) rotate(${-angle}deg)`;
 const animation=body.envelope.animate([
  {transform:'none'},
  {transform:squash(1-strength,1+strength*.5),offset:.24},
  {transform:squash(1+strength*.3,1-strength*.15),offset:.64},
  {transform:'none'}
 ],{duration:280,easing:'ease-out'});
 body.impact=animation;
 animation.onfinish=()=>{if(body.impact===animation)body.impact=null;};
}
function pauseArcheryMotion(){
 cancelAnimationFrame(archeryMotionFrame);archeryMotionFrame=null;
 if(!archeryMotion)return;
 archeryMotion.last=null;
 for(const body of archeryMotion.bodies)if(body.impact?.playState==='running')body.impact.pause();
}
function cancelArcheryMotion(){
 pauseArcheryMotion();
 if(archeryMotion){archeryMotion.observer.disconnect();for(const body of archeryMotion.bodies)body.impact?.cancel();}
 archeryMotion=null;
}
function paintArcheryMotion(state){
 for(const body of state.bodies){
  body.element.style.transform=`translate3d(${(body.x-body.rx).toFixed(3)}px,${(body.y-body.ry).toFixed(3)}px,0)`;
 }
 syncArcheryAimTarget();
}
function placeArcheryBody(state,body){
 const fits=()=>body.x>=body.rx+8&&body.x<=state.width-body.rx-8&&body.y>=body.ry+8&&body.y<=state.height-body.ry-8&&
  !state.obstacles.some(box=>archeryObstacleContact(body,box))&&state.bodies.every(other=>other===body||other.active===false||
   ((body.x-other.x)/(body.rx+other.rx+ARCHERY_BALLOON_GAP))**2+((body.y-other.y)/(body.ry+other.ry+ARCHERY_BALLOON_GAP))**2>=1);
 if(fits())return;
 // Only a newly inflated balloon needs a vacant position. The other balloons
 // keep their positions and velocities when the words/turn change.
 const origin={x:body.x,y:body.y},candidates=[];
 for(let row=0;row<=16;row++)for(let column=0;column<=24;column++){
  const x=body.rx+8+column/24*(state.width-16-2*body.rx),y=body.ry+8+row/16*(state.height-16-2*body.ry);
  candidates.push({x,y,distance:(x-origin.x)**2+(y-origin.y)**2});
 }
 for(const candidate of candidates.sort((a,b)=>a.distance-b.distance)){
  body.x=candidate.x;body.y=candidate.y;if(fits())return;
 }
 body.x=origin.x;body.y=origin.y;
}
function readArcheryObstacles(state){
 const field=state.layer.parentElement,layer=state.layer.getBoundingClientRect();
 // Reserve only the actual controls, not full-width strips above/below the
 // balloons. Bow rotation during a drag must never alter these static bounds.
 state.obstacles=[...field.querySelectorAll('.scene-clue,.archery-countdown,.archery-combo,.archery-bow')].map(element=>{
  if(element.matches('.archery-bow'))return {left:element.offsetLeft-state.layer.offsetLeft,top:element.offsetTop-state.layer.offsetTop,right:element.offsetLeft+element.offsetWidth-state.layer.offsetLeft,bottom:element.offsetTop+element.offsetHeight-state.layer.offsetTop};
  const rect=element.getBoundingClientRect();return {left:rect.left-layer.left,top:rect.top-layer.top,right:rect.right-layer.left,bottom:rect.bottom-layer.top};
 });
}
function sizeArcheryMotion(state){
 const width=state.layer.clientWidth,layerHeight=state.layer.clientHeight;
 const stringRoom=state.bodies[0].element.querySelector('.balloon-string').offsetHeight+13;
 const height=Math.max(1,layerHeight-stringRoom),columns=width>=486?4:2,rows=Math.ceil(state.bodies.length/columns);
 const balloonWidth=Math.min(134,(width-16-18*(columns-1))/columns);
 const baseHeight=parseFloat(getComputedStyle(state.layer).getPropertyValue('--balloon-base-height'))||132;
 const balloonHeight=Math.min(baseHeight,(height-16-18*(rows-1))/rows);
 const oldWidth=state.width,oldHeight=state.height;
 const resized=width!==oldWidth||height!==oldHeight||balloonWidth!==state.balloonWidth||balloonHeight!==state.balloonHeight;
 state.layer.style.setProperty('--balloon-physics-width',`${balloonWidth}px`);
 state.layer.style.setProperty('--balloon-physics-height',`${balloonHeight}px`);
 if(!resized)return false;
 state.width=width;state.height=height;state.balloonWidth=balloonWidth;state.balloonHeight=balloonHeight;
 state.settings=archeryMotionSettings(state.round.attempt,width,height);readArcheryObstacles(state);
 state.bodies.forEach((body,slot)=>{
  const rx=balloonWidth/2,ry=balloonHeight/2;
  const fractionX=oldWidth?(body.x-8-body.rx)/Math.max(1,oldWidth-16-2*body.rx):(slot%columns)/(columns-1);
  const fractionY=oldHeight?(body.y-8-body.ry)/Math.max(1,oldHeight-16-2*body.ry):rows===1?(slot%2?.75:.25):Math.floor(slot/columns)/(rows-1);
  body.x=8+rx+Math.max(0,Math.min(1,fractionX))*(width-16-2*rx);
  body.y=8+ry+Math.max(0,Math.min(1,fractionY))*(height-16-2*ry);
  body.rx=rx;body.ry=ry;body.mass=rx*ry;
  if(!oldWidth){const angle=Math.random()*Math.PI*2;body.vx=Math.cos(angle)*state.settings.speed*body.pace;body.vy=Math.sin(angle)*state.settings.speed*body.pace;}
 });
 for(const body of state.bodies)placeArcheryBody(state,body);
 // Resizing changes the available space, not the round, score or countdown.
 for(let pass=0;pass<12;pass++){
  for(let i=0;i<state.bodies.length;i++)for(let j=i+1;j<state.bodies.length;j++)collideArcheryBalloons(state,state.bodies[i],state.bodies[j]);
  for(const body of state.bodies){keepArcheryControlsClear(state,body);bounceArcheryWalls(state,body);}
 }
 return true;
}
function tickArcheryMotion(){
 archeryMotionFrame=null;
 if(!archeryMotionCanRun()){pauseArcheryMotion();return;}
 const state=archeryMotion,now=elapsedGameMs(state.round);
 advanceArcheryPhysics(state,state.last===null?0:(now-state.last)/1000);state.last=now;
 paintArcheryMotion(state);paintArcheryShot();archeryMotionFrame=requestAnimationFrame(tickArcheryMotion);
}
function syncArcheryMotion(){
 const round=adventure,layer=document.querySelector('.archery-targets');
 if(screen!=='adventure'||round?.mode!=='archery'||!round.archeryStarted||round.done||!layer){cancelArcheryMotion();return;}
 if(!archeryMotion||archeryMotion.round!==round||archeryMotion.layer!==layer){
  cancelArcheryMotion();
  const state={round,attempt:round.attempt,layer,bodies:[],time:0,accumulator:0,last:null,onImpact:animateArcheryContact};
  state.bodies=[...layer.querySelectorAll('.word-balloon')].map(element=>({element,envelope:element.querySelector('.balloon-envelope'),randomSeed:1+Math.floor(Math.random()*4294967294),pace:.94+Math.random()*.12,active:true}));
  state.observer=new ResizeObserver(()=>{if(archeryMotion===state)syncArcheryMotion();});
  archeryMotion=state;state.observer.observe(layer);
 }
 const state=archeryMotion;
 layer.classList.add('is-physical');sizeArcheryMotion(state);
 if(state.attempt!==round.attempt){
  state.attempt=round.attempt;state.settings=archeryMotionSettings(round.attempt,state.width,state.height);
  readArcheryObstacles(state);
  for(const body of state.bodies){
   if(body.active===false){placeArcheryBody(state,body);body.active=true;}
   else if(state.obstacles.some(box=>archeryObstacleContact(body,box)))placeArcheryBody(state,body);
  }
 }
 paintArcheryMotion(state);
 if(!archeryMotionCanRun()){
  pauseArcheryMotion();
  if(calm||archeryMotionPreference.matches)for(const body of state.bodies){body.impact?.cancel();body.impact=null;}
  return;
 }
 for(const body of state.bodies)if(body.impact?.playState==='paused')body.impact.play();
 if(archeryMotionFrame===null){state.last=elapsedGameMs(round);archeryMotionFrame=requestAnimationFrame(tickArcheryMotion);}
}
document.addEventListener('visibilitychange',()=>document.hidden?pauseArcheryMotion():syncArcheryMotion());
window.addEventListener('pagehide',pauseArcheryMotion);
window.addEventListener('pageshow',syncArcheryMotion);
archeryMotionPreference.addEventListener('change',syncArcheryMotion);
