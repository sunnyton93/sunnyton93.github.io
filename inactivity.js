// Stable storage, independent of the service worker/release version.
const INACTIVITY_STORAGE_KEY='ximena-activity-v1';
const INACTIVITY_PERIOD_MS=48*60*60*1000;
const INACTIVITY_STAR_GOAL=5;
let activityOpening=null,activityDialog=null,activityUnsavedQualifiedAt=0;
const activityTimestamp=value=>Number.isSafeInteger(value)&&value>=0;
function activityStarTotal(){
 const saved=JSON.parse(localStorage.getItem('ximena-islands-v1')||'{}');
 // Merge per game, so a stale tab cannot forget stars earned in another window.
 const keys=new Set([...Object.keys(saved||{}),...Object.keys(islandProgress)]);
 let total=0;
 for(const key of keys){
  const match=/^(\d+)-(find|connect|archery|platforms|pirate|blaster)$/.exec(key);
  if(!match||!islandLessons[Number(match[1])])continue;
  const valid=value=>Number.isInteger(value)&&value>=1&&value<=3?value:0;
  total+=Math.max(valid(saved?.[key]),valid(islandProgress[key]));
 }
 return total;
}
function readActivity(now=Date.now(),newStars=0){
 const raw=localStorage.getItem(INACTIVITY_STORAGE_KEY);
 if(!raw)return {version:2,startedAt:now,lastOpenedAt:now,lastRewardAt:null,lastReward:null,rewards:{coins:0,stars:0},lastPenaltyAt:null,penalties:[],starBaseline:Math.max(0,activityStarTotal()-newStars),lastQualifiedAt:now};
 const state=JSON.parse(raw);
 if(![1,2].includes(state?.version)||!activityTimestamp(state.startedAt)||!activityTimestamp(state.lastOpenedAt)||
  ![state.lastRewardAt,state.lastPenaltyAt].every(value=>value===null||activityTimestamp(value))||
  !state.rewards||![state.rewards.coins,state.rewards.stars].every(activityTimestamp)||!Array.isArray(state.penalties))throw new Error('Invalid activity save');
 if(state.version===1){
  // Existing stars establish the new baseline; the new rule starts with a full 48 hours.
  state.version=2;state.starBaseline=Math.max(0,activityStarTotal()-newStars);state.lastQualifiedAt=now;
 }
 if(!activityTimestamp(state.starBaseline)||!activityTimestamp(state.lastQualifiedAt))throw new Error('Invalid activity star goal');
 return state;
}
function writeActivity(state){localStorage.setItem(INACTIVITY_STORAGE_KEY,JSON.stringify(state));}
function qualifyActivityStars(state,at){
 const total=activityStarTotal();
 if(total-state.starBaseline<INACTIVITY_STAR_GOAL)return false;
 state.starBaseline=total;state.lastQualifiedAt=Math.max(state.lastQualifiedAt,at);
 activityUnsavedQualifiedAt=Math.max(activityUnsavedQualifiedAt,state.lastQualifiedAt);
 return true;
}
function recordActivityReward({coins=0,stars=0,source='game',at=Date.now(),id=null}={}){
 if(!activityTimestamp(coins)||!activityTimestamp(stars)||coins+stars<1)return true;
 try{
  const state=readActivity(at,stars);
  // Marine receipts may be recovered more than once after an interrupted save.
  if(id&&state.lastMarineRewardId===id)return true;
  if(id)state.lastMarineRewardId=id;
  state.lastRewardAt=Math.max(state.lastRewardAt??0,at);
  if(!state.lastReward||at>=state.lastReward.at)state.lastReward={at,coins,stars,source};
  for(const [kind,amount] of Object.entries({coins,stars}))state.rewards[kind]=Math.min(Number.MAX_SAFE_INTEGER,state.rewards[kind]+amount);
  if(stars>0)qualifyActivityStars(state,at);
  writeActivity(state);return true;
 }catch{return false;}
}
function readActivityBalance(){
 const value=Number(localStorage.getItem(COIN_STORAGE_KEY)||0);
 if(!activityTimestamp(value))throw new Error('Invalid coin balance');
 return value;
}
function settleInactivityPenalty(state=readActivity()){
 const receipt=state.pendingPenalty;if(!receipt)return null;
 // Unfinished receipts created by the old rule retain their original 10% debit.
 const percent=receipt.percent??10;
 if(![10,20].includes(percent)||![receipt.at,receipt.before,receipt.after,receipt.amount].every(activityTimestamp)||receipt.amount!==Math.floor(receipt.before/(percent===20?5:10))||receipt.after!==receipt.before-receipt.amount)throw new Error('Invalid inactivity receipt');
 const current=readActivityBalance();
 if(current===receipt.before)localStorage.setItem(COIN_STORAGE_KEY,String(receipt.after));
 // Later rewards/purchases must never be overwritten by an old receipt.
 state.lastPenaltyAt=receipt.at;
 if(!state.penalties.some(item=>item.id===receipt.id))state.penalties.push(receipt);
 delete state.pendingPenalty;
 writeActivity(state);
 coinBalance=readActivityBalance();syncCoinHud();
 return receipt;
}
function prepareActivityCoinChange(){
 let state;
 try{state=readActivity();}catch{return;}
 // Finish the receipt before any later coin write. Otherwise a later balance
 // equal to receipt.before could be mistaken for an unpaid penalty on recovery.
 settleInactivityPenalty(state);
}
function checkInactivityOpening(){
 if(activityOpening)return activityOpening;
 activityOpening=withMarineLock(()=>{
  const now=Date.now(),state=readActivity(now);
  state.lastOpenedAt=Math.max(state.lastOpenedAt,now);
  // A new installation receives a full grace period; historical dates are unknown.
  writeActivity(state);
  const recovered=settleInactivityPenalty(state);
  // Recover earned marine coins using their original reward date before checking.
  const marine=readMarineSave();prepareMarineRound(marine,now);
  const latest=readActivity(now);
  if(qualifyActivityStars(latest,now))writeActivity(latest);
  const reference=Math.max(latest.startedAt,latest.lastQualifiedAt,latest.lastPenaltyAt??0,activityUnsavedQualifiedAt);
  if(recovered)return recovered;
  if(now-reference<=INACTIVITY_PERIOD_MS)return null;
  const before=readActivityBalance(),amount=Math.floor(before/5);
  const receipt={id:`inactivity-${now}`,at:now,periodStartedAt:reference,before,amount,after:before-amount,percent:20};
  // Persist intent before touching coins. Recovery cannot charge this period twice.
  latest.pendingPenalty=receipt;writeActivity(latest);
  return settleInactivityPenalty(latest);
 }).then(receipt=>{
  if(receipt)showInactivityShark(receipt);
  return receipt;
 }).catch(()=>{
  const toast=document.querySelector('#toast');
  if(toast){toast.textContent='No se pudo guardar la visita. Tu progreso sigue aquí; vuelve a abrir el juego para reintentar.';toast.classList.add('show');}
  return null;
 }).finally(()=>{activityOpening=null;});
 return activityOpening;
}

function inactivitySharkArt(){return `<svg class="inactivity-shark" viewBox="0 0 420 260" aria-hidden="true">
 <defs><linearGradient id="mordisquitos-skin" x2=".3" y2="1"><stop stop-color="#86b8bc"/><stop offset="1" stop-color="#487f90"/></linearGradient></defs>
 <ellipse cx="210" cy="233" rx="131" ry="12" fill="#286777" opacity=".12"/>
 <g class="shark-swagger">
  <g class="shark-tail"><path d="M117 140Q58 122 39 69l3 66-21 51q50-3 96-46Z" fill="#6398a7" stroke="#376b80" stroke-width="3"/><path d="m43 135 52 6" fill="none" stroke="#c6e1db" stroke-width="3"/></g>
  <path d="M175 96Q174 38 208 29q-4 40 36 69" fill="#679baa" stroke="#376b80" stroke-width="3"/>
  <path d="M96 137Q151 72 253 89q81 5 129 54 14 20-17 33-121 57-223 2Z" fill="url(#mordisquitos-skin)" stroke="#376b80" stroke-width="3"/>
  <path d="M135 154q119 46 242-3-10 30-105 45-89 12-137-42Z" fill="#e3eee0"/>
  <path d="M144 119q35-27 92-22" fill="none" stroke="#c5e2db" stroke-width="5" stroke-linecap="round"/>
  <path class="shark-fin" d="M208 157q12 49 63 56l-25-52" fill="#548798" stroke="#376b80" stroke-width="3"/>
  <g fill="none" stroke="#3f7382" stroke-width="4" stroke-linecap="round"><path d="m262 120-6 16m-7-19-6 16m-7-18-5 16"/></g>
  <g class="shark-eyes"><ellipse cx="304" cy="120" rx="15" ry="14" fill="#fffae6"/><ellipse cx="336" cy="124" rx="10" ry="12" fill="#fffae6"/><g class="shark-pupils"><ellipse cx="308" cy="121" rx="5" ry="7" fill="#304455"/><ellipse cx="337" cy="125" rx="4" ry="6" fill="#304455"/><circle cx="310" cy="119" r="2" fill="#fff"/><circle cx="338" cy="123" r="1.5" fill="#fff"/></g></g>
  <g class="shark-brows" fill="none" stroke="#304e62" stroke-width="6" stroke-linecap="round"><path d="m286 103 31 10m13 3 14-8"/></g>
  <g class="shark-mouth"><path d="M285 147q42 13 70-4-6 34-39 29-24-3-31-25Z" fill="#354958" stroke="#304e62" stroke-width="3"/><path d="m290 150 10 13 6-9 10 12 8-10 9 8 9-13" fill="#fff8dc"/><path d="M308 168q15-11 28-3-11 12-28 3" fill="#e09d94"/></g>
  <path d="m279 148 8-5m66 0 8-4" stroke="#304e62" stroke-width="3" stroke-linecap="round"/>
 </g>
 <g class="shark-loot" fill="#f5cb66" stroke="#bc873c" stroke-width="2"><path d="M62 191 57 179q26 9 48 0l-7 14q38 48-15 50-53-2-21-52Z" fill="#bd8753" stroke="#80643e" stroke-width="3"/><path d="M62 192q21 8 36 0" fill="none" stroke="#f7db89" stroke-width="5"/><circle cx="83" cy="214" r="16"/><circle cx="83" cy="214" r="11" fill="none"/><path d="m83 205 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1Z" fill="#fff3b1" stroke="none"/></g>
</svg>`;}
function inactivityDisplayBalance(){
 const dialog=activityDialog;
 // A concurrent reward/purchase must replace, never be overwritten by, the visual countdown.
 return dialog?.displayBalance!==null&&dialog?.displayBalance!==undefined&&coinBalance===dialog.receipt.after?dialog.displayBalance:coinBalance;
}
function positionInactivityFocus(dialog){
 const hud=document.querySelector('.hud-coins'),rect=hud?.getBoundingClientRect();
 const focus=dialog.querySelector('.inactivity-hud-focus');
 const left=rect?.width?rect.left:20,top=rect?.height?rect.top:20;
 focus.style.left=`${Math.max(12,Math.min(innerWidth-focus.offsetWidth-12,left))}px`;
 focus.style.top=`${Math.max(12,Math.min(44,top))}px`;
}
function paintInactivityScene(dialog,elapsed){
 const {receipt,scene}=dialog,phase=elapsed<400?'arrive':elapsed<2200?'talk':elapsed<3100?'laugh':elapsed<5300?'take':'done';
 dialog.dataset.phase=phase;dialog.classList.toggle('is-speaking',phase==='talk');
 const taking=Math.max(0,Math.min(1,(elapsed-3100)/2200));
 const canCount=receipt.amount>0&&coinBalance===receipt.after&&activityTimestamp(receipt.before);
 dialog.displayBalance=phase!=='done'&&canCount?receipt.before-Math.floor(receipt.amount*taking):null;
 syncCoinHud();
 const focus=dialog.querySelector('.inactivity-hud-focus'),origin=focus.getBoundingClientRect();
 const svg=dialog.querySelector('.inactivity-shark'),matrix=svg.getScreenCTM();
 if(matrix){
  const destination=new DOMPoint(83,193).matrixTransform(matrix),eye=new DOMPoint(320,123).matrixTransform(matrix);
  const gaze=['arrive','take'].includes(phase)?{x:origin.x+origin.width/2,y:origin.y+origin.height/2}:scene.pointer||{x:eye.x+45,y:eye.y+20};
  dialog.querySelector('.shark-pupils').setAttribute('transform',`translate(${Math.max(-4,Math.min(3,(gaze.x-eye.x)/70))} ${Math.max(-3,Math.min(3,(gaze.y-eye.y)/80))})`);
  scene.coins.forEach((coin,index)=>{
   const t=(elapsed-3150-index*105)/680,visible=canCount&&t>=0&&t<=1;
   coin.hidden=!visible;if(!visible)return;
   const start={x:origin.x+origin.width/2,y:origin.y+origin.height/2},bend={x:(start.x+destination.x)/2+80,y:Math.min(start.y,destination.y)+30};
   const x=(1-t)**2*start.x+2*(1-t)*t*bend.x+t*t*destination.x;
   const y=(1-t)**2*start.y+2*(1-t)*t*bend.y+t*t*destination.y;
   coin.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${t*420+index*27}deg) scale(${1-t*.45})`;
   coin.style.opacity=String(Math.min(1,t*8,(1-t)*10));
  });
 }
 if(phase==='done'&&!scene.finished){
  scene.finished=true;
  dialog.querySelector('.inactivity-status').textContent=receipt.amount>0?`Descuento realizado: ${receipt.amount.toLocaleString('es-MX')} monedas.`:'Esta vez el descuento es de 0 monedas.';
 }
}
function runInactivityScene(dialog){
 const reduced=calm||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const coins=[...dialog.querySelectorAll('.inactivity-flying-coin')];
 dialog.scene={elapsed:0,last:performance.now(),cue:0,coins,finished:false,frame:null};
 dialog.dataset.reduced=String(reduced);positionInactivityFocus(dialog);
 if(reduced){paintInactivityScene(dialog,5300);SoundWorld.play('mordisquitos-arrive');return;}
 const cues=[[0,'mordisquitos-arrive'],[400,'mordisquitos-talk'],[1300,'mordisquitos-talk'],[2200,'mordisquitos-laugh'],
  ...(dialog.receipt.amount>0?[[3100,'mordisquitos-take'],[3450,'mordisquitos-coin'],[3820,'mordisquitos-coin'],[4190,'mordisquitos-coin'],[4560,'mordisquitos-coin'],[5300,'mordisquitos-finish']]:[])];
 const tick=now=>{
  const scene=dialog.scene;scene.frame=null;if(activityDialog!==dialog)return;
  if(!document.hidden){
   scene.elapsed+=Math.min(100,Math.max(0,now-scene.last));
   paintInactivityScene(dialog,scene.elapsed);
   while(scene.cue<cues.length&&scene.elapsed>=cues[scene.cue][0])SoundWorld.play(cues[scene.cue++][1]);
  }
  scene.last=now;
  if(scene.elapsed<5500)scene.frame=requestAnimationFrame(tick);
 };
 dialog.scene.tick=tick;tick(performance.now());
}
function closeInactivityShark(){
 const dialog=activityDialog;if(!dialog)return;
 SoundWorld.play('close');
 activityDialog=null;cancelAnimationFrame(dialog.scene?.frame);dialog.listeners.abort();
 dialog.getAnimations({subtree:true}).forEach(animation=>animation.cancel());dialog.close();dialog.remove();syncCoinHud();
 delete document.documentElement.dataset.inactivityDialog;
 document.querySelector('.blaster-frame')?.contentWindow?.postMessage({type:'host-pause',paused:false},location.origin);
 const round=dialog.pausedRound;
 if(round&&adventure===round&&!round.done&&!document.hidden){round.pausedMs+=performance.now()-round.pausedAt;round.pausedAt=null;if(gameClockActive)startGameClock();}
 syncArcheryMotion();
 (dialog.returnFocus?.isConnected?dialog.returnFocus:document.querySelector('.map-viewport'))?.focus({preventScroll:true});
}
function showInactivityShark(receipt){
 if(activityDialog)return;
 closeMarineEncounter(false);
 const dialog=document.createElement('dialog');activityDialog=dialog;
 dialog.receipt=receipt;dialog.displayBalance=null;dialog.listeners=new AbortController();
 dialog.returnFocus=document.activeElement;
 if(adventure&&!adventure.done&&adventure.pausedAt===null){dialog.pausedRound=adventure;adventure.pausedAt=performance.now();clearInterval(gameClockTimer);}
 const number=value=>value.toLocaleString('es-MX');
 let progress=0;try{progress=Math.max(0,Math.min(4,activityStarTotal()-readActivity().starBaseline));}catch{}
 dialog.className='inactivity-dialog';dialog.setAttribute('aria-labelledby','inactivity-title');dialog.setAttribute('aria-describedby','inactivity-speech');
 dialog.innerHTML=`<div class="inactivity-hud-focus hud-coins" aria-hidden="true">${goldCoinIcon()}<b data-inactivity-balance>${number(coinBalance)}</b><small>−${number(receipt.amount)}</small></div>
  <div class="inactivity-card"><button type="button" class="inactivity-close" aria-label="Cerrar aviso">×</button>
  <p class="inactivity-eyebrow">UNA VISITA TRAVIESA</p><h2 id="inactivity-title">¡Je, je… volviste!</h2>
  <div class="inactivity-speech"><p id="inactivity-speech">Por no haber jugado, me llevo <b>${number(receipt.amount)} ${receipt.amount===1?'moneda':'monedas'}</b>.</p></div>
  <div class="inactivity-portrait"><div class="inactivity-shark-halo"></div>${inactivitySharkArt()}<span class="inactivity-laugh" aria-hidden="true">¡Je, je, je!</span><span class="inactivity-name">Capitán Mordisquitos</span></div>
  <div class="inactivity-receipt"><strong>−${number(receipt.amount)} ${goldCoinIcon()}</strong></div>
  <div class="inactivity-star-goal"><span aria-hidden="true">${Array.from({length:5},(_,i)=>`<i class="${i<progress?'earned':''}">★</i>`).join('')}</span></div>
  <span class="inactivity-status" role="status" aria-live="polite"></span>
  <button type="button" class="inactivity-continue">¡A ganar estrellas! <span aria-hidden="true">→</span></button></div>
  <div class="inactivity-flight-layer" aria-hidden="true">${Array.from({length:Math.min(14,receipt.amount)},()=>`<span class="inactivity-flying-coin" hidden>${goldCoinIcon()}</span>`).join('')}</div>`;
 dialog.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('.inactivity-close,.inactivity-continue'))closeInactivityShark();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeInactivityShark();});
 dialog.addEventListener('keydown',event=>{
  event.stopPropagation();if(event.key!=='Tab')return;
  const first=dialog.querySelector('.inactivity-close'),last=dialog.querySelector('.inactivity-continue');
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 document.body.append(dialog);document.documentElement.dataset.inactivityDialog='true';dialog.showModal();dialog.querySelector('.inactivity-continue').focus({preventScroll:true});
 dialog.addEventListener('pointermove',event=>{if(dialog.scene)dialog.scene.pointer={x:event.clientX,y:event.clientY};},{signal:dialog.listeners.signal});
 window.addEventListener('resize',()=>positionInactivityFocus(dialog),{signal:dialog.listeners.signal});
 runInactivityScene(dialog);
 pauseArcheryMotion();
 document.querySelector('.blaster-frame')?.contentWindow?.postMessage({type:'host-pause',paused:true},location.origin);
}
window.addEventListener('pageshow',()=>{checkInactivityOpening();});
document.addEventListener('visibilitychange',()=>{
 if(activityDialog?.scene)activityDialog.scene.last=performance.now();
 if(document.hidden)return;
 // The game's own resume handler runs first. Keep its clock paused while talking.
 if(activityDialog&&adventure===activityDialog.pausedRound&&!adventure.done&&adventure.pausedAt===null){adventure.pausedAt=performance.now();clearInterval(gameClockTimer);}
 checkInactivityOpening();
});
