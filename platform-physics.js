// Salta's world-space simulation. Rendering and input devices never advance physics.
const SaltaPhysics=(()=>{
 const STEP=1/120,GRAVITY=1450,DEG=Math.PI/180;
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 function settings(completed){
  const late=clamp(completed-7,0,4);
  return {scale:completed<4?1:completed<8?1.22+(completed-4)*.012:1.28+late*.02,
   drift:late?5+late*2:0,tilt:late?10+late*1.3:completed>=4?7:3.2,maxSpeed:late?19+late:24};
 }
 function create(centers){
  return {x:300,y:220,z:0,height:0,vx:0,vy:0,vz:0,airborne:false,rider:0,time:0,accumulator:0,spread:1,
   baseCenters:centers.map(point=>[...point]),centers:centers.map(point=>[...point]),
   bodies:centers.map(([x,y])=>({x,y,vx:0,vy:0})),
   floats:centers.map(()=>({depth:0,depthVelocity:0,roll:0,rollVelocity:0,pitch:0,pitchVelocity:0,rippleAt:-Infinity})),
   settings:settings(0),jumpAt:null,landedAt:null,gapMs:0,fell:false,sliding:false};
 }
 function at(x,y,centers){
  let nearest=-1,distance=Infinity;
  centers.forEach(([cx,cy],index)=>{
   const dx=Math.abs(x-cx),dy=Math.abs(y-cy),d=dx*dx+dy*dy;
   if(dx<=79&&dx+Math.sqrt(3)*dy<=158&&d<distance){nearest=index;distance=d;}
  });
  return nearest;
 }
 function available(p,index,now=p.time){
  return index>=0&&(!['collapse','success','fall'].includes(p.phase)||index===p.safe||now-p.phaseAt<260);
 }
 function height(p,index,x=p.x,y=p.y){
  if(index<0)return -40;
  const state=p.floats[index],dx=x-p.centers[index][0],dy=y-p.centers[index][1];
  return -state.depth-dx*Math.sin(state.roll*DEG)-dy*(Math.sin(state.pitch*DEG)+.68*(Math.cos(state.pitch*DEG)-1));
 }
 function configure(p,completed,now,respawn){
  p.settings=settings(completed);p.time=now;p.accumulator=0;p.fell=false;p.sliding=false;
  if(respawn){[p.x,p.y]=p.centers[0];p.vx=p.vy=0;}
  p.jumpAt=null;p.airborne=false;p.vz=0;p.gapMs=0;p.z=0;
  p.rider=at(p.x,p.y,p.centers);p.height=height(p,p.rider);
 }
 function spring(state,key,target,dt,stiffness=85,damping=16){
  const velocity=key+'Velocity';state[velocity]+=(stiffness*(target-state[key])-damping*state[velocity])*dt;state[key]+=state[velocity]*dt;
 }
 function collide(a,b){
  // Separating-axis contact for the six-sided decks, with a gentle inelastic impulse.
  let overlap=Infinity,nx=0,ny=0;
  for(const [x,y] of [[1,0],[.5,Math.sqrt(3)/2],[.5,-Math.sqrt(3)/2]]){
   const projection=(b.x-a.x)*x+(b.y-a.y)*y,depth=158-Math.abs(projection);
   if(depth<=0)return;
   if(depth<overlap){overlap=depth;const sign=projection<0?-1:1;nx=x*sign;ny=y*sign;}
  }
  const correction=Math.min(.4,overlap/2+.001);
  a.x-=nx*correction;a.y-=ny*correction;b.x+=nx*correction;b.y+=ny*correction;
  const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(closing<0){const impulse=-closing*.6;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}
 }
 function constrain(body){
  for(const [axis,velocity,low,high] of [['x','vx',88,512],['y','vy',42,408]]){
   if(body[axis]<low){body[axis]=low;if(body[velocity]<0)body[velocity]*=-.2;}
   if(body[axis]>high){body[axis]=high;if(body[velocity]>0)body[velocity]*=-.2;}
  }
 }
 function moveDecks(p,dt){
  const before=p.centers.map(point=>[...point]),t=p.time/1000,s=p.settings;
  p.spread+=(s.scale-p.spread)*(1-Math.exp(-dt*3));
  p.bodies.forEach((body,i)=>{
   const base=p.baseCenters[i],phase=i*2.399;
   // Several slow currents create variation without frame-dependent random jolts.
   const dx=s.drift*(Math.sin(t*.83+phase)*.62+Math.sin(t*1.37+phase*.7)*.38);
   const dy=s.drift*(Math.cos(t*.71+phase)*.62+Math.sin(t*1.19+phase*1.4)*.38);
   const tx=300+(base[0]-300)*p.spread+dx,ty=220+(base[1]-220)*p.spread+dy;
   body.vx+=((tx-body.x)*22-body.vx*9)*dt;body.vy+=((ty-body.y)*22-body.vy*9)*dt;
   const speed=Math.hypot(body.vx,body.vy),limit=s.maxSpeed;
   if(speed>limit){body.vx*=limit/speed;body.vy*=limit/speed;}
   body.x+=body.vx*dt;body.y+=body.vy*dt;
  });
  // The opening layout deliberately shares seams. Contacts activate as it opens.
  if(p.spread>1.12)for(let i=0;i<p.bodies.length;i++)for(let j=i+1;j<p.bodies.length;j++)collide(p.bodies[i],p.bodies[j]);
  p.bodies.forEach((body,i)=>{constrain(body);p.centers[i][0]=body.x;p.centers[i][1]=body.y;});
  if(!p.airborne&&available(p,p.rider)&&p.phase!=='fall'){
   p.x+=p.centers[p.rider][0]-before[p.rider][0];p.y+=p.centers[p.rider][1]-before[p.rider][1];
  }
 }
 function jump(p,now){
  if(p.jumpAt!==null||p.airborne||p.fell||p.gapMs>65||!['prepare','seek','collapse'].includes(p.phase))return false;
  p.jumpAt=now;return true;
 }
 function step(p,input,dt){
  p.time+=dt*1000;moveDecks(p,dt);
  const playing=['prepare','seek','collapse'].includes(p.phase);
  let support=at(p.x,p.y,p.centers);
  if(!available(p,support)||p.phase==='fall'||p.airborne)support=-1;
  if(!p.airborne&&support!==p.rider){
   // Keep world momentum when walking from one moving deck to another.
   const old=p.bodies[p.rider],next=p.bodies[support];
   p.vx+=(old?.vx||0)-(next?.vx||0);p.vy+=(old?.vy||0)-(next?.vy||0);p.rider=support;
  }
  p.floats.forEach((state,i)=>{
   const loaded=i===support,dx=loaded?p.x-p.centers[i][0]:0,dy=loaded?p.y-p.centers[i][1]:0;
   spring(state,'depth',loaded?4.8:0,dt,105,17);
   spring(state,'roll',clamp(dx/79,-1,1)*p.settings.tilt,dt,65,15);
   spring(state,'pitch',clamp(dy/91,-1,1)*p.settings.tilt,dt,65,15);
  });
  if(!playing||p.fell){p.vx=p.vy=0;if(support>=0)p.height=height(p,support);return;}
  const length=Math.hypot(input.x,input.y),strength=Math.min(1,length),ix=length?input.x/length*strength:0,iy=length?input.y/length*strength:0;
  p.moveX=ix;p.moveY=iy;p.strength=strength;p.walking=strength>.01;if(Math.abs(ix)>.01)p.facing=ix<0?-1:1;
  if(p.jumpAt!==null&&!p.airborne&&p.time-p.jumpAt>=55){
   const body=p.bodies[support];p.vx+=body?.vx||0;p.vy+=body?.vy||0;
   p.height=support>=0?height(p,support):p.height;p.vz=Math.sqrt(2*GRAVITY*64);p.airborne=true;p.rider=-1;support=-1;
  }
  const speed=p.airborne?220:185,response=p.airborne?6:strength?18:9;
  let ax=(ix*speed-p.vx)*response,ay=(iy*speed-p.vy)*response;
  const acceleration=Math.hypot(ax,ay),maxAcceleration=p.airborne?850:1600;
  if(acceleration>maxAcceleration){ax*=maxAcceleration/acceleration;ay*=maxAcceleration/acceleration;}
  let slopeX=0,slopeY=0;
  if(support>=0){slopeX=GRAVITY*Math.sin(p.floats[support].roll*DEG);slopeY=GRAVITY*Math.sin(p.floats[support].pitch*DEG);}
  const slope=Math.hypot(slopeX,slopeY),normal=Math.sqrt(Math.max(0,GRAVITY*GRAVITY-slope*slope));
  p.sliding=support>=0&&slope>normal*.14;
  if(support>=0&&strength===0&&Math.hypot(p.vx,p.vy)<2&&slope<=normal*.14){p.vx=p.vy=0;}
  else{
   p.vx+=(ax+slopeX)*dt;p.vy+=(ay+slopeY)*dt;
   const velocity=Math.hypot(p.vx,p.vy),friction=support>=0?normal*.095*dt:0;
   if(velocity){const remaining=Math.max(0,Math.min(235,velocity-friction))/velocity;p.vx*=remaining;p.vy*=remaining;}
  }
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  for(const [axis,velocity,low,high] of [['x','vx',12,588],['y','vy',-15,450]]){
   if(p[axis]<low||p[axis]>high){p[axis]=clamp(p[axis],low,high);p[velocity]*=-.15;}
  }
  support=at(p.x,p.y,p.centers);if(!available(p,support))support=-1;
  if(p.airborne){
   const previous=p.height;p.height+=p.vz*dt-GRAVITY*dt*dt/2;p.vz-=GRAVITY*dt;
   const surface=height(p,support);
   if(support>=0&&p.vz<0&&p.height<=surface&&previous>=surface-3){
    const impact=Math.min(65,Math.abs(p.vz)*.11),state=p.floats[support];
    p.airborne=false;p.jumpAt=null;p.vz=0;p.height=surface;p.rider=support;p.gapMs=0;p.landedAt=p.time;
    p.vx-=p.bodies[support].vx;p.vy-=p.bodies[support].vy;
    state.depthVelocity+=impact;state.rollVelocity+=(p.x-p.centers[support][0])*.12;state.pitchVelocity+=(p.y-p.centers[support][1])*.08;state.rippleAt=p.time;
   }else if(p.height<-38){p.fell=true;}
  }else{
   if(support<0){p.gapMs+=dt*1000;if(p.gapMs>(p.settings.scale>1?65:95)&&p.jumpAt===null)p.fell=true;}
   else{p.gapMs=0;p.height=height(p,support);}
  }
  p.z=p.airborne?Math.max(0,p.height):0;
 }
 function advance(p,seconds,input){
  p.accumulator+=clamp(seconds,0,.1);
  while(p.accumulator+1e-10>=STEP){step(p,input,STEP);p.accumulator-=STEP;}
 }
 return {STEP,GRAVITY,settings,create,configure,at,height,jump,advance,collide,constrain};
})();
