// Stable storage, independent of the service worker/release version.
const INACTIVITY_STORAGE_KEY='ximena-activity-v1';
const INACTIVITY_PERIOD_MS=48*60*60*1000;
let activityOpening=null,activityDialog=null,activityUnsavedRewardAt=0;
const activityTimestamp=value=>Number.isSafeInteger(value)&&value>=0;
function readActivity(now=Date.now()){
 const raw=localStorage.getItem(INACTIVITY_STORAGE_KEY);
 if(!raw)return {version:1,startedAt:now,lastOpenedAt:now,lastRewardAt:null,lastReward:null,rewards:{coins:0,stars:0},lastPenaltyAt:null,penalties:[]};
 const state=JSON.parse(raw);
 if(state?.version!==1||!activityTimestamp(state.startedAt)||!activityTimestamp(state.lastOpenedAt)||
  ![state.lastRewardAt,state.lastPenaltyAt].every(value=>value===null||activityTimestamp(value))||
  !state.rewards||![state.rewards.coins,state.rewards.stars].every(activityTimestamp)||!Array.isArray(state.penalties))throw new Error('Invalid activity save');
 return state;
}
function writeActivity(state){localStorage.setItem(INACTIVITY_STORAGE_KEY,JSON.stringify(state));}
function recordActivityReward({coins=0,stars=0,source='game',at=Date.now(),id=null}={}){
 if(!activityTimestamp(coins)||!activityTimestamp(stars)||coins+stars<1)return true;
 activityUnsavedRewardAt=Math.max(activityUnsavedRewardAt,at);
 try{
  const state=readActivity(at);
  // Marine receipts may be recovered more than once after an interrupted save.
  if(id&&state.lastMarineRewardId===id)return true;
  if(id)state.lastMarineRewardId=id;
  state.lastRewardAt=Math.max(state.lastRewardAt??0,at);
  if(!state.lastReward||at>=state.lastReward.at)state.lastReward={at,coins,stars,source};
  for(const [kind,amount] of Object.entries({coins,stars}))state.rewards[kind]=Math.min(Number.MAX_SAFE_INTEGER,state.rewards[kind]+amount);
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
 if(![receipt.at,receipt.before,receipt.after,receipt.amount].every(activityTimestamp)||receipt.amount!==Math.floor(receipt.before/10)||receipt.after!==receipt.before-receipt.amount)throw new Error('Invalid inactivity receipt');
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
  const reference=Math.max(latest.startedAt,latest.lastRewardAt??0,latest.lastPenaltyAt??0,activityUnsavedRewardAt);
  if(recovered)return recovered;
  if(now-reference<=INACTIVITY_PERIOD_MS)return null;
  const before=readActivityBalance(),amount=Math.floor(before/10);
  const receipt={id:`inactivity-${now}`,at:now,periodStartedAt:reference,before,amount,after:before-amount};
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
  <g class="shark-eyes"><ellipse cx="304" cy="120" rx="15" ry="14" fill="#fffae6"/><ellipse cx="336" cy="124" rx="10" ry="12" fill="#fffae6"/><ellipse cx="310" cy="123" rx="5" ry="7" fill="#304455"/><ellipse cx="339" cy="126" rx="4" ry="6" fill="#304455"/><circle cx="312" cy="121" r="2" fill="#fff"/><circle cx="340" cy="124" r="1.5" fill="#fff"/></g>
  <g class="shark-brows" fill="none" stroke="#304e62" stroke-width="6" stroke-linecap="round"><path d="m286 103 31 10m13 3 14-8"/></g>
  <g class="shark-mouth"><path d="M285 147q42 13 70-4-6 34-39 29-24-3-31-25Z" fill="#354958" stroke="#304e62" stroke-width="3"/><path d="m290 150 10 13 6-9 10 12 8-10 9 8 9-13" fill="#fff8dc"/><path d="M308 168q15-11 28-3-11 12-28 3" fill="#e09d94"/></g>
  <path d="m279 148 8-5m66 0 8-4" stroke="#304e62" stroke-width="3" stroke-linecap="round"/>
 </g>
 <g class="shark-loot" fill="#f5cb66" stroke="#bc873c" stroke-width="2"><circle cx="83" cy="209" r="18"/><circle cx="83" cy="209" r="12" fill="none"/><path d="m83 200 3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1Z" fill="#fff3b1" stroke="none"/></g>
</svg>`;}
function closeInactivityShark(){
 const dialog=activityDialog;if(!dialog)return;
 activityDialog=null;dialog.getAnimations({subtree:true}).forEach(animation=>animation.cancel());dialog.close();dialog.remove();
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
 dialog.returnFocus=document.activeElement;
 if(adventure&&!adventure.done&&adventure.pausedAt===null){dialog.pausedRound=adventure;adventure.pausedAt=performance.now();clearInterval(gameClockTimer);}
 const number=value=>value.toLocaleString('es-MX');
 dialog.className='inactivity-dialog is-speaking';dialog.setAttribute('aria-labelledby','inactivity-title');dialog.setAttribute('aria-describedby','inactivity-speech');
 dialog.innerHTML=`<button type="button" class="inactivity-close" aria-label="Cerrar aviso">×</button>
  <h2 id="inactivity-title">¡Je, je… volviste!</h2>
  <div class="inactivity-speech"><p id="inactivity-speech">Por no haber jugado, me voy a llevar <b>${number(receipt.amount)} ${receipt.amount===1?'moneda':'monedas'}</b>.</p></div>
  <div class="inactivity-portrait">${inactivitySharkArt()}<span class="inactivity-name">Capitán Mordisquitos</span></div>
  <button type="button" class="inactivity-continue">¡A ganar tesoros! <span aria-hidden="true">→</span></button>`;
 dialog.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('.inactivity-close,.inactivity-continue'))closeInactivityShark();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeInactivityShark();});
 dialog.addEventListener('keydown',event=>{
  event.stopPropagation();if(event.key!=='Tab')return;
  const first=dialog.querySelector('.inactivity-close'),last=dialog.querySelector('.inactivity-continue');
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 dialog.addEventListener('animationend',event=>{if(event.animationName==='shark-talk')dialog.classList.remove('is-speaking');});
 document.body.append(dialog);document.documentElement.dataset.inactivityDialog='true';dialog.showModal();dialog.querySelector('.inactivity-continue').focus({preventScroll:true});
 pauseArcheryMotion();
 document.querySelector('.blaster-frame')?.contentWindow?.postMessage({type:'host-pause',paused:true},location.origin);
}
window.addEventListener('pageshow',()=>{checkInactivityOpening();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)return;
 // The game's own resume handler runs first. Keep its clock paused while talking.
 if(activityDialog&&adventure===activityDialog.pausedRound&&!adventure.done&&adventure.pausedAt===null){adventure.pausedAt=performance.now();clearInterval(gameClockTimer);}
 checkInactivityOpening();
});
