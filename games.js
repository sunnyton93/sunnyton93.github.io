const gameModes = {find:'Encuentra',connect:'Conecta',memory:'Memoria',archery:'Atrapa',platforms:'Salta',pirate:'Banderas',blaster:'Escribe'};
const ISLAND_LINEUP_KEY='ximena-island-games-v2';
const REQUIRED_ISLAND_GAMES=['find','connect'];
const MAIN_GAMES_PER_ISLAND=4,COMPLETION_COINS=40,MEMORY_COMPLETION_COINS=200;
const MEMORY_REVIEW_PAIRS=3;
let islandLineupSaved=true;
const islandGameLineups=readIslandGameLineups();
const ISLAND_COIN_BONUS_KEY='ximena-island-coin-bonus-v1';
const islandCoinBonuses=readIslandCoinBonuses();
function readIslandCoinBonuses(){
 let stored={};try{stored=JSON.parse(localStorage.getItem(ISLAND_COIN_BONUS_KEY)||'{}')||{};}catch{}
 const bonuses={};let changed=false;
 // One fixed winner per group; the final partial group also gets one winner.
 for(let first=2;first<islandLessons.length;first+=4){
  const count=Math.min(4,islandLessons.length-first),saved=stored[first];
  const valid=Number.isInteger(saved)&&saved>=first&&saved<first+count;
  bonuses[first]=valid?saved:first+Math.floor(Math.random()*count);
  if(!valid)changed=true;
 }
 if(changed){try{localStorage.setItem(ISLAND_COIN_BONUS_KEY,JSON.stringify(bonuses));}catch{}}
 return bonuses;
}
function islandCoinMultiplier(index){
 if(index===0||index===1)return 2;
 return islandCoinBonuses[2+Math.floor((index-2)/4)*4]===index?2:1;
}
function islandCoinBadge(index){return islandCoinMultiplier(index)===2?'<span class="island-coin-bonus" title="Monedas dobles en todos los juegos de esta isla" aria-label="Monedas dobles en todos los juegos de esta isla">🪙 ×2</span>':'';}
function readIslandGameLineups(){
 const candidates=Object.keys(gameModes).filter(mode=>mode!=='memory'&&!REQUIRED_ISLAND_GAMES.includes(mode));
 let stored={};try{stored=JSON.parse(localStorage.getItem(ISLAND_LINEUP_KEY)||'{}')||{};}catch{}
 const lineups={};let changed=false;
 for(let index=0;index<islandLessons.length;index++){
  const saved=stored[index];
  const valid=Array.isArray(saved)&&saved.length===MAIN_GAMES_PER_ISLAND&&saved[0]==='find'&&saved[1]==='connect'&&new Set(saved).size===MAIN_GAMES_PER_ISLAND&&saved.slice(2).every(mode=>candidates.includes(mode));
  lineups[index]=valid?[...saved]:[...REQUIRED_ISLAND_GAMES,...shuffle(candidates).slice(0,MAIN_GAMES_PER_ISLAND-REQUIRED_ISLAND_GAMES.length)];
  if(!valid)changed=true;
 }
 if(changed){try{localStorage.setItem(ISLAND_LINEUP_KEY,JSON.stringify(lineups));}catch{islandLineupSaved=false;}}
 return lineups;
}
function progressionModes(index=0){return islandGameLineups[index]||[];}
function islandModes(index){return [...progressionModes(index),'memory'];}
function lastGameMode(index){return progressionModes(index).at(-1);}
function starsPerIsland(){return MAIN_GAMES_PER_ISLAND*3;}
// Preserve stars already earned in games removed by the one-time draw.
function legacyStars(){return islandLessons.reduce((sum,_,index)=>sum+Object.keys(gameModes).filter(mode=>mode!=='memory'&&!progressionModes(index).includes(mode)).reduce((subtotal,mode)=>subtotal+(islandProgress[`${index}-${mode}`]||0),0),0);}
let adventure = null;
// Correlate iframe messages within this page, including over local-network HTTP.
// The sender is also checked by its origin and contentWindow; this is not an auth token.
let blasterSessionCounter = 0;
let lockedIslandIndex = 14;
let gameTurnTimer;
let islandProgress = {};
let progressSaved = true;
const COIN_STORAGE_KEY='ximena-coins-v1';
const BEST_TIMES_KEY='ximena-best-times-v1';
const COIN_IMPROVEMENTS_KEY='ximena-coin-improvements-v1';
const MAX_COIN_IMPROVEMENTS=3;
let bestTimes={};
function readCoinImprovements(){
 const counts={};
 try{const stored=JSON.parse(localStorage.getItem(COIN_IMPROVEMENTS_KEY)||'{}');for(const [key,value] of Object.entries(stored||{}))if(/^\d+-(find|connect|archery|platforms|pirate|blaster)$/.test(key)&&Number.isInteger(value)&&value>=0)counts[key]=Math.min(value,MAX_COIN_IMPROVEMENTS);}catch{}
 return counts;
}
let coinImprovements=readCoinImprovements();
const COIN_PACE_SECONDS={find:6,connect:8,memory:12,archery:7,platforms:9,pirate:6,blaster:12};
let gameClockTimer,gameClockActive=false;
function startGameClock(){gameClockActive=true;clearInterval(gameClockTimer);gameClockTimer=document.hidden?null:setInterval(updateGameClock,100);}
function stopGameClock(){gameClockActive=false;clearInterval(gameClockTimer);gameClockTimer=null;}
function readCoinBalance(){
 try{const value=Number(localStorage.getItem(COIN_STORAGE_KEY)||0);return Number.isSafeInteger(value)&&value>=0?value:0;}catch{return 0;}
}
let coinBalance=readCoinBalance();
function elapsedGameMs(round){
 if(round.mode==='archery'&&!round.archeryStarted)return 0;
 if(round.mode==='platforms'&&!round.platformStarted)return 0;
 if(round.mode==='pirate'&&!round.pirateStarted)return 0;
 if(round.mode==='blaster'&&!round.blasterStarted)return 0;
 if(round.done)return round.durationMs;
 return Math.max(0,(round.pausedAt??performance.now())-round.startedAt-round.pausedMs);
}
function gameTime(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
function coinReward(mode,target,seconds){
 const reference=COIN_PACE_SECONDS[mode]*target;
 return COMPLETION_COINS+Math.round(60/(1+Math.max(0,seconds)/reference));
}
function updateGameClock(){
 const clock=document.querySelector('.game-clock time');
 if(!clock||!adventure||adventure.done)return;
 const time=gameTime(elapsedGameMs(adventure));
 if(clock.textContent!==time)clock.textContent=time;
 if(adventure.mode==='archery')updateArcheryCountdown();
 if(adventure.mode==='pirate')updatePirateRound();
}
function awardCoins(amount){
 coinBalance=Math.min(Number.MAX_SAFE_INTEGER,Math.max(coinBalance,readCoinBalance())+amount);
 let saved=true;
 try{localStorage.setItem(COIN_STORAGE_KEY,String(coinBalance));}catch{saved=false;}
 syncCoinHud();return saved;
}
function spendCoins(amount){
 coinBalance=Math.max(0,Math.max(coinBalance,readCoinBalance())-amount);
 let saved=true;try{localStorage.setItem(COIN_STORAGE_KEY,String(coinBalance));}catch{saved=false;}
 syncCoinHud();return saved;
}
function syncCoinHud(){const value=coinBalance.toLocaleString('es-MX');document.querySelectorAll('.hud-coins b,[data-coin-balance]').forEach(el=>{if(el.textContent!==value)el.textContent=value;});}
document.addEventListener('visibilitychange',()=>{
 const round=adventure;if(!round||round.done||(!gameClockActive&&!round.blasterRunning))return;
 if(document.hidden){if(round.pausedAt===null)round.pausedAt=performance.now();clearInterval(gameClockTimer);gameClockTimer=null;}
 else{if(round.pausedAt!==null){round.pausedMs+=performance.now()-round.pausedAt;round.pausedAt=null;}if(gameClockActive)startGameClock();updateGameClock();}
});
window.addEventListener('storage',event=>{if(event.key===COIN_STORAGE_KEY||event.key===null){coinBalance=readCoinBalance();syncCoinHud();}});
function memoryReward(round){
 // Unseen guesses are exploration. Only forgotten known mates or repeated misses count against recall.
 round.memoryBonus=Math.round(30/(1+round.memoryRecallErrors)+10*round.memoryRecallHits/round.target);
 round.speedBonus=Math.round(20/(1+round.durationMs/60000));
 return MEMORY_COMPLETION_COINS+round.memoryBonus+round.speedBonus;
}
function coinRewardView(round){
 if(!round.coins)return '';
 return `<div class="coin-reward" role="status">${goldCoinIcon()}<div><strong>+${round.coins} monedas</strong>${round.coinMultiplier===2?'<small>¡Recompensa doble de esta isla!</small>':''}</div></div>`;
}
try {const stored=JSON.parse(localStorage.getItem('ximena-islands-v1')||'{}');for(const [key,value] of Object.entries(stored||{}))if(/^\d+-(find|connect|archery|platforms|pirate|blaster)$/.test(key)&&Number.isInteger(value)&&value>=1&&value<=3)islandProgress[key]=value;} catch {}
function readBestTimes(){
 const records={};
 try{const stored=JSON.parse(localStorage.getItem(BEST_TIMES_KEY)||'{}');for(const [key,value] of Object.entries(stored||{}))if(/^\d+-(find|connect|memory|archery|platforms|pirate|blaster)$/.test(key)&&Number.isSafeInteger(value)&&value>=0)records[key]=value;}catch{}
 return records;
}
bestTimes=readBestTimes();
function memoryBonusCompleted(index){
 // Existing records also identify bonuses completed before this update.
 const key=`${index}-memory`;
 return (bestTimes[key]??readBestTimes()[key])!==undefined;
}
function recordCompletion(round){
 bestTimes={...bestTimes,...readBestTimes()};
 const key=`${round.index}-${round.mode}`;
 round.previousBest=bestTimes[key]??null;
 round.isNewBest=round.previousBest===null||round.durationMs<round.previousBest;
 round.bestTime=round.isNewBest?round.durationMs:round.previousBest;
 round.earnsCoins=round.mode==='memory'?!round.memoryReplay:round.isNewBest&&(round.previousBest===null||(coinImprovements[key]||0)<MAX_COIN_IMPROVEMENTS);
 round.coinImprovementLimitReached=round.mode!=='memory'&&round.isNewBest&&round.previousBest!==null&&!round.earnsCoins;
 if(round.earnsCoins&&round.previousBest!==null){
  coinImprovements[key]=(coinImprovements[key]||0)+1;
  try{localStorage.setItem(COIN_IMPROVEMENTS_KEY,JSON.stringify(coinImprovements));}catch{}
 }
 round.recordSaved=true;
 if(round.isNewBest){bestTimes[key]=round.durationMs;try{localStorage.setItem(BEST_TIMES_KEY,JSON.stringify(bestTimes));}catch{round.recordSaved=false;}}
}
luceroOpenRoutes=readLuceroRoutes();
function shuffle(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function reshuffle(items){const result=shuffle(items);return result.every((id,i)=>id===items[i])?[...items.slice(1),items[0]]:result;}
function modeStars(index,mode){
 if(mode==='memory'&&memoryBonusCompleted(index))return '<span class="bonus-badge">Completado · Jugar sin monedas</span>';
 if(mode==='memory')return `<span class="bonus-badge"><span class="bonus-coin">${goldCoinIcon()}</span><span class="bonus-caption"><span class="bonus-amount"><span>¡Gana más de</span> ${MEMORY_COMPLETION_COINS*islandCoinMultiplier(index)} <span>monedas!</span></span></span></span>`;
 const count=islandProgress[`${index}-${mode}`]||0;
 return `<span class="mode-stars" role="img" aria-label="${count} de 3 estrellas">${[1,2,3].map(n=>`<span class="mode-star ${n<=count?'is-earned':'is-unearned'}" style="--star-index:${n-1}" aria-hidden="true">★</span>`).join('')}</span>`;
}
// Temporary development setup: set both flags to false to restore normal access.
const islandDevSettings={lockAll:false,rightClickEntry:true};
function isIslandLocked(island,stars=totalStars()){return (islandDevSettings.lockAll&&island!==oceanIslands[0])||luceroRouteClosed(island)||stars<(island.requiredStars||0);}
function lockedIslandView(){
 const island=oceanIslands[lockedIslandIndex],required=island.requiredStars||0,stars=totalStars();
 if(islandDevSettings.lockAll)return `${header(island.name,'ISLA BLOQUEADA')}<section class="locked-island-panel"><div class="island-lock" aria-hidden="true">🔒</div><h2>Esta isla está bloqueada</h2><button class="primary" data-action="map">Volver a las islas →</button></section>`;
 return `${header(island.name,'ISLA BLOQUEADA')}<section class="locked-island-panel"><div class="island-lock" aria-hidden="true">🔒</div><h2>¡Reúne ${required} estrellas!</h2><p>Te faltan ${Math.max(0,required-stars)} estrellas para abrir esta isla.</p><div class="unlock-progress"><progress max="${required}" value="${Math.min(stars,required)}" aria-label="Estrellas para desbloquear"></progress><b>★ ${stars} / ${required}</b></div><button class="primary" data-action="map">Volver a las islas →</button></section>`;
}
function resultActions(){
 const destinations=nextIslands(adventure.index),completed=adventure.mode===lastGameMode(adventure.index)&&islandComplete(adventure.index);
 const replay='<button class="result-action replay-action" data-play="restart" aria-label="Jugar otra vez" title="Jugar otra vez"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 23a21 21 0 1 1-2 24M15 10v15h15"/></svg></button>';
 if(completed&&destinations.length===2)return `<p class="route-choice-title">¡Elige tu próxima ruta!</p><div class="result-actions route-actions">${replay}${destinations.map(index=>`<button class="route-choice" data-play="route" data-destination="${index}" style="--route-color:${islandRoutes[oceanIslands[index].routeIndex].color}"><span aria-hidden="true">↗</span><b>${islandRoutes[oceanIslands[index].routeIndex].name}</b><small>${oceanIslands[index].name} · ★ ${oceanIslands[index].requiredStars}</small></button>`).join('')}</div>`;
 const label=completed?(destinations.length?'Siguiente isla':'Volver al mapa'):'Siguiente';
 return `<div class="result-actions">${replay}<button class="result-action next-action" data-play="next" aria-label="${label}" title="${label}"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 32h35M34 15l17 17-17 17"/></svg></button></div>`;
}
function unlockCelebration(indices=[],dismissed=false){
 if(!indices.length||dismissed)return '';
 const island=oceanIslands[indices[0]];
 const illustration=`<svg class="unlock-island-art" viewBox="-175 -195 350 280" aria-hidden="true"><ellipse class="unlock-water-ring" cy="50" rx="151" ry="29" fill="none" stroke="#8bc8c4" stroke-width="2"/><g class="unlock-floating-island"><ellipse cy="36" rx="127" ry="29" fill="#739a8750"/><ellipse cy="26" rx="124" ry="30" fill="#efd8a0"/><ellipse cy="20" rx="111" ry="26" fill="${island.color}"/>${islandScenery(island.type)}</g></svg>`;
 return `<div class="unlock-celebration"><section class="unlock-reward" role="dialog" aria-modal="true" aria-labelledby="unlock-title"><button class="unlock-close" data-play="unlock-close" aria-label="Cerrar recompensa">×</button><div class="unlock-hero" aria-hidden="true"><span class="unlock-glint glint-left">✦</span>${illustration}<span class="unlock-glint glint-right">✧</span><div class="unlock-seal"><svg viewBox="0 0 80 80"><path class="unlock-shackle" d="M25 37V24a15 15 0 0 1 30 0v4"/><rect x="19" y="35" width="42" height="34" rx="9"/><path class="unlock-check" d="m29 51 8 8 15-16"/></svg></div></div><h3 id="unlock-title">¡${indices.length===1?'Isla desbloqueada':'Nuevas islas desbloqueadas'}!</h3><p class="unlock-preview-copy">Has desbloqueado:</p><div class="unlock-islands">${indices.map(i=>`<p><span class="unlock-island-star" aria-hidden="true">★</span><span>${oceanIslands[i].name}</span></p>`).join('')}</div><button class="unlock-continue" data-play="unlock-close">¡A explorar! <span aria-hidden="true">➜</span></button></section></div>`;
}
function connectLinks(a){return `<svg class="pair-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${a.matched.map(id=>{const y1=(a.left.indexOf(id)+.5)*100/a.left.length,y2=(a.right.indexOf(id)+.5)*100/a.right.length;return `<path d="M40 ${y1} C47 ${y1} 53 ${y2} 60 ${y2}"/>`;}).join('')}</svg>`;}
function memoryVocabularyForIsland(index){
 const words=islandLessons[index].words.map(word=>({...word}));
 const normalize=text=>text.trim().toLowerCase();
 const english=new Set(words.map(word=>normalize(word.en))),spanish=new Set(words.map(word=>normalize(word.es)));
 const previousWords=islandLessons.slice(0,index).flatMap((lesson,previous)=>isIslandLocked(oceanIslands[previous])?[]:lesson.words);
 const target=words.length+MEMORY_REVIEW_PAIRS;
 for(const word of shuffle(previousWords)){
  // Avoid ambiguous pairs, including words shared by several islands.
  if(english.has(normalize(word.en))||spanish.has(normalize(word.es)))continue;
  words.push({...word,id:words.length});
  english.add(normalize(word.en));spanish.add(normalize(word.es));
  if(words.length===target)break;
 }
 // With no earlier vocabulary (the first island), keep the original pairs.
 return words;
}
function memoryView(a){
 const island=oceanIslands[a.index];
 const backArt=`<svg class="memory-island-art" viewBox="-150 -185 300 255" aria-hidden="true"><ellipse cy="43" rx="125" ry="22" fill="var(--room-accent)" opacity=".12"/><ellipse cy="28" rx="115" ry="28" fill="#f5dfb0"/><ellipse cy="23" rx="104" ry="23" fill="${island.color}"/>${islandScenery(island.type)}</svg>`;
 return `${a.memoryReplay?'<p class="memory-replay-notice" role="status">Este bonus ya fue completado en esta isla. Puedes volver a jugar, pero no habrá recompensa ni monedas.</p>':''}<div class="memory-playground"><div class="memory-board">${a.deck.map((card,i)=>{
  const open=a.picks.includes(card.id)||a.matched.includes(card.word),matched=a.matched.includes(card.word),word=a.memoryVocabulary[card.word];
  return `<button class="memory-card ${open?'is-open':''} ${matched?'is-matched':''} ${a.wrong.includes(card.id)?'is-wrong':''}" style="--deal-index:${i};--pearl-hue:${matched?(155+a.memoryWords.indexOf(card.word)*29)%360:155}" data-play="memory" data-id="${card.id}" ${matched||a.picks.includes(card.id)||a.pending?'disabled':''} aria-label="${open?word[card.english?'en':'es']:`Carta ${i+1}, boca abajo`}"><span class="memory-flipper" aria-hidden="true"><span class="memory-face memory-back"><span class="memory-emblem">${backArt}</span><i class="memory-glint">✧</i></span><span class="memory-face memory-front"><b>${word[card.english?'en':'es']}</b><span class="memory-stamp">${matched?'✓':a.wrong.includes(card.id)?'×':''}</span></span></span></button>`;
 }).join('')}</div></div>`;
}
let memoryTextBoard=null;
const memoryTextObserver=new ResizeObserver(()=>fitMemoryText());
function fitMemoryText(){
 if(!memoryTextBoard?.isConnected)return;
 for(const label of memoryTextBoard.querySelectorAll('.memory-front b')){
  label.style.removeProperty('font-size');
  const face=label.parentElement,style=getComputedStyle(face);
  const height=face.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  if(label.clientWidth<=0||height<=0)continue;
  const fits=()=>label.scrollWidth<=label.clientWidth&&label.offsetHeight<=height;
  if(fits())continue;
  // Keep the largest size that fits, wrapping only at word boundaries.
  let low=1,high=Math.floor(parseFloat(getComputedStyle(label).fontSize)*4);
  while(low<high){
   const middle=Math.ceil((low+high)/2);
   label.style.fontSize=`${middle/4}px`;
   if(fits())low=middle;else high=middle-1;
  }
  label.style.fontSize=`${low/4}px`;
 }
}
function syncMemoryText(){
 const board=document.querySelector('.memory-board');
 if(board!==memoryTextBoard){
  memoryTextObserver.disconnect();memoryTextBoard=board;
  if(board)memoryTextObserver.observe(board);
 }
 fitMemoryText();
}
document.fonts?.addEventListener('loadingdone',()=>fitMemoryText());
let archeryImpactTimer;
let archeryAnimations=[];
let archeryAim=null;
let connectDrag=null;
let suppressConnectClick=false;
function clearConnectDrag(){
 const drag=connectDrag;connectDrag=null;
 document.querySelectorAll('.pair-card.is-dragging,.pair-card.is-drop-target').forEach(el=>el.classList.remove('is-dragging','is-drop-target'));
 drag?.preview?.remove();
 if(drag?.button.hasPointerCapture(drag.pointerId))drag.button.releasePointerCapture(drag.pointerId);
}
const ARCHERY_WINDOW_MS=6000;
function beginArchery(){
 const round=adventure;
 if(screen!=='adventure'||round?.mode!=='archery'||round.archeryStarted||round.done)return;
 round.archeryStarted=true;round.startedAt=performance.now();round.pausedMs=0;round.pausedAt=document.hidden?round.startedAt:null;
 round.balloons=archeryOptions(round);resetArcheryWindow(round);
 startGameClock();
 SoundWorld.play('tap');render();document.querySelector('[data-archery-bow]')?.focus({preventScroll:true});
}
function archeryOptions(round){
 const correct=round.order[round.attempt%round.order.length];
 const wordIds=islandLessons[round.index].words.map(word=>word.id);
 const options=shuffle([correct,...shuffle(wordIds.filter(id=>id!==correct)).slice(0,3)]);
 if(round.balloons&&options.every(id=>round.balloons.includes(id))){
  const fresh=wordIds.find(id=>!round.balloons.includes(id));
  if(fresh!==undefined)options[options.findIndex(id=>id!==correct)]=fresh;
 }
 return options;
}
// Attempts change the clue; only successful answers advance completion.
function advanceRoundAttempt(round,correct){
 round.attempt++;
 if(round.attempt%round.order.length===0){
  const previous=round.order.at(-1),next=reshuffle(round.order);
  if(next.length>1&&next[0]===previous)next.push(next.shift());
  round.order=next;
 }
 if(correct)round.step++;
}
function advanceArcheryRound(round,correct=false){
 advanceRoundAttempt(round,correct);round.pending=false;
 if(round.step===round.target)finishAdventure();
 else{round.balloons=archeryOptions(round);resetArcheryWindow(round);}
 render();
 document.querySelector(round.done?'[data-play="restart"]':'[data-archery-bow]')?.focus({preventScroll:true});
}
function resetArcheryWindow(round){round.archeryDeadline=elapsedGameMs(round)+ARCHERY_WINDOW_MS;}
function updateArcheryCountdown(){
 const round=adventure;if(!round||!round.archeryStarted||round.done||round.pending||screen!=='adventure')return;
 const remaining=Math.max(0,round.archeryDeadline-elapsedGameMs(round));
 if(remaining===0){
  cancelArcheryAim();round.mistakes++;round.streak=0;round.notice='¡Tiempo! Vamos con otra palabra y nuevos globos.';
  SoundWorld.play('wrong');advanceArcheryRound(round,false);
  const feedback=document.querySelector('.archery-feedback');if(feedback)feedback.textContent=round.notice;
  return;
 }
 const timer=document.querySelector('.archery-countdown');if(!timer)return;
 timer.querySelector('b').textContent=`${(remaining/1000).toFixed(1)} s`;
 timer.style.setProperty('--time-left',remaining/ARCHERY_WINDOW_MS);
 timer.classList.toggle('is-urgent',remaining<=1500);
}
function cancelArcheryAim(){
 const aim=archeryAim;archeryAim=null;
 if(aim?.handle.hasPointerCapture(aim.pointerId))aim.handle.releasePointerCapture(aim.pointerId);
 const field=document.querySelector('.archery-field');
 field?.classList.remove('is-aiming');field?.querySelectorAll('.is-aimed').forEach(el=>el.classList.remove('is-aimed'));
 field?.querySelector('.archery-bow')?.style.removeProperty('transform');
 field?.querySelector('.bow-string')?.setAttribute('d','M18 58 75 70 132 58');
}
function archeryTargetAt(x,y){
 return [...document.querySelectorAll('.word-balloon')].find(button=>{
  const box=button.querySelector('.balloon-body').getBoundingClientRect();
  return ((x-box.x-box.width/2)/(box.width/2))**2+((y-box.y-box.height/2)/(box.height/2))**2<=1;
 });
}
document.addEventListener('pointerdown',event=>{
 const button=event.target.closest('.connect-board .pair-card');
 if(!button||event.button!==0||adventure?.mode!=='connect'||adventure.done||adventure.pending||button.disabled)return;
 event.preventDefault();event.stopPropagation();
 const rect=button.getBoundingClientRect();
 connectDrag={button,pointerId:event.pointerId,round:adventure,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,moved:false};
 button.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
 const drag=connectDrag;if(!drag||event.pointerId!==drag.pointerId)return;
 drag.moved ||= Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>8;
 if(!drag.moved)return;
 event.preventDefault();
 if(!drag.preview){
  const rect=drag.button.getBoundingClientRect();
  drag.preview=drag.button.cloneNode(true);
  // The floating copy lives outside the board: preserve its responsive styles.
  const originals=[drag.button,...drag.button.querySelectorAll('*')];
  const copies=[drag.preview,...drag.preview.querySelectorAll('*')];
  originals.forEach((original,index)=>{
   const computed=getComputedStyle(original);
   for(const property of computed)copies[index].style.setProperty(property,computed.getPropertyValue(property));
  });
  drag.preview.classList.remove('is-picked','is-dragging');drag.preview.classList.add('pair-drag-preview');
  drag.preview.removeAttribute('data-play');drag.preview.removeAttribute('data-id');drag.preview.removeAttribute('data-side');drag.preview.removeAttribute('disabled');
  drag.preview.setAttribute('aria-hidden','true');drag.preview.tabIndex=-1;
  Object.assign(drag.preview.style,{position:'fixed',left:'0',top:'0',right:'auto',bottom:'auto',boxSizing:'border-box',width:`${rect.width}px`,height:`${rect.height}px`,minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none'});document.body.append(drag.preview);
 }
 drag.preview.style.transform=`translate3d(${event.clientX-drag.offsetX}px,${event.clientY-drag.offsetY}px,0)`;
 const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.connect-board .pair-card');
 document.querySelectorAll('.pair-card.is-dragging,.pair-card.is-drop-target').forEach(el=>el.classList.remove('is-dragging','is-drop-target'));
 drag.button.classList.add('is-dragging');
 if(target&&target!==drag.button&&target.dataset.side!==drag.button.dataset.side&&!target.disabled)target.classList.add('is-drop-target');
});
document.addEventListener('pointerup',event=>{
 const drag=connectDrag;if(!drag||event.pointerId!==drag.pointerId)return;
 const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.connect-board .pair-card');
 clearConnectDrag();
 if(!drag.moved)return;
 suppressConnectClick=true;setTimeout(()=>{suppressConnectClick=false;},0);
 event.preventDefault();event.stopPropagation();
 if(adventure!==drag.round||!target||target===drag.button||target.disabled||target.dataset.side===drag.button.dataset.side)return;
 adventure.picks=[`${drag.button.dataset.side}-${drag.button.dataset.id}`];
 handleAdventure(target);
});
document.addEventListener('pointercancel',event=>{if(connectDrag?.pointerId===event.pointerId)clearConnectDrag();});
document.addEventListener('lostpointercapture',event=>{if(connectDrag?.pointerId===event.pointerId)clearConnectDrag();});
document.addEventListener('click',event=>{
 if(!suppressConnectClick||!event.target.closest('.connect-board .pair-card'))return;
 event.preventDefault();event.stopImmediatePropagation();
},true);
window.addEventListener('blur',clearConnectDrag);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearConnectDrag();});

document.addEventListener('pointerdown',event=>{
 const handle=event.target.closest('[data-archery-bow]');
 if(!handle||event.button!==0||adventure?.mode!=='archery'||!adventure.archeryStarted||adventure.done||adventure.pending||archeryAim)return;
 updateArcheryCountdown();
 if(adventure.done||!handle.isConnected)return;
 event.preventDefault();event.stopPropagation();
 archeryAim={handle,pointerId:event.pointerId,round:adventure,startX:event.clientX,startY:event.clientY,moved:false};
 handle.setPointerCapture(event.pointerId);document.querySelector('.archery-field').classList.add('is-aiming');
 document.querySelector('.archery-feedback').textContent='';
});
document.addEventListener('pointermove',event=>{
 const aim=archeryAim;if(!aim||event.pointerId!==aim.pointerId)return;
 event.preventDefault();
 const field=document.querySelector('.archery-field'),box=field.getBoundingClientRect();
 const x=Math.max(0,Math.min(box.width,event.clientX-box.x)),y=Math.max(0,Math.min(box.height,event.clientY-box.y));
 const origin={x:box.width/2,y:box.height-43};
 aim.moved ||= Math.hypot(event.clientX-aim.startX,event.clientY-aim.startY)>12;
 const angle=Math.atan2(y-origin.y,x-origin.x)*180/Math.PI+90;
 field.querySelector('.archery-bow').style.transform=`rotate(${Math.max(-75,Math.min(75,angle))}deg)`;
 const tension=Math.min(18,Math.hypot(x-origin.x,y-origin.y)/12);
 field.querySelector('.bow-string').setAttribute('d',`M18 58 75 ${70+tension} 132 58`);
 const guide=field.querySelector('.archery-aim-guide');guide.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
 guide.querySelector('path').setAttribute('d',`M${origin.x} ${origin.y} Q${(origin.x+x)/2} ${Math.min(origin.y,y)-25} ${x} ${y}`);
 const reticle=field.querySelector('.archery-reticle');reticle.style.left=`${x}px`;reticle.style.top=`${y}px`;
 field.querySelectorAll('.is-aimed').forEach(el=>el.classList.remove('is-aimed'));
 archeryTargetAt(event.clientX,event.clientY)?.classList.add('is-aimed');
});
document.addEventListener('pointerup',event=>{
 const aim=archeryAim;if(!aim||event.pointerId!==aim.pointerId)return;
 const target=archeryTargetAt(event.clientX,event.clientY);
 cancelArcheryAim();event.preventDefault();
 if(aim.moved&&adventure===aim.round&&!adventure.pending)shootBalloon(target,{x:event.clientX,y:event.clientY},aim);
});
document.addEventListener('pointercancel',event=>{if(archeryAim?.pointerId===event.pointerId)cancelArcheryAim();});
document.addEventListener('lostpointercapture',event=>{if(archeryAim?.pointerId===event.pointerId)cancelArcheryAim();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&archeryAim){event.preventDefault();event.stopImmediatePropagation();cancelArcheryAim();}});
window.addEventListener('resize',cancelArcheryAim);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelArcheryAim();});
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-archery-bow]'))return;
 event.preventDefault();event.stopPropagation();
},true);
function archeryView(round,lesson){
 if(!round.archeryStarted)return `<div class="archery-intro"><div class="archery-intro-art" aria-hidden="true">🏹 <span>🎈</span></div><h2>¡Apunta y atrapa la palabra!</h2><button class="primary archery-start" data-play="archery-start">Iniciar <span aria-hidden="true">➜</span></button></div>`;
 const word=lesson.words[round.order[round.attempt%round.order.length]];
 return `<div class="archery-game"><div class="archery-field ${round.pending?'is-shooting':''}"><div class="scene-clue archery-prompt"><span class="archery-clue" aria-hidden="true">${word.icon}</span><h2>${word.es}</h2><span class="scene-score archery-round" aria-label="${round.step} aciertos de ${round.target}">★ ${round.step}/${round.target}</span></div><div class="archery-countdown" style="--time-left:1" aria-label="Tiempo para este tiro"><span>◷</span><b>${round.pending?'En vuelo':`${(Math.max(0,round.archeryDeadline-elapsedGameMs(round))/1000).toFixed(1)} s`}</b><i></i></div><div class="archery-cloud archery-cloud-one"></div><div class="archery-cloud archery-cloud-two"></div><div class="archery-targets">${round.balloons.map((id,slot)=>`<div class="word-balloon" role="img" data-id="${id}" style="--balloon-color:${['#f7c872','#8cdbcd','#b9b4ed','#f3a9b4'][slot]};--float-delay:${slot*-.7}s" aria-label="Globo: ${lesson.words[id].en}"><span class="balloon-body"><b>${lesson.words[id].en}</b><span class="balloon-shine" aria-hidden="true"></span></span><span class="balloon-string" aria-hidden="true"></span><span class="balloon-burst" aria-hidden="true">✦</span></div>`).join('')}</div><svg class="archery-aim-guide" aria-hidden="true"><path/></svg><span class="archery-reticle" aria-hidden="true"></span><div class="archery-particles" aria-hidden="true"></div><svg class="archery-flight" aria-hidden="true"><path class="archery-trail"/><g class="archery-arrow"><path d="M-92 0H0" stroke="#765134" stroke-width="5"/><path d="M0 0-16-8-12 0-16 8Z" fill="#5b8392"/><path d="M-68 0-82-10H-96L-82 0-96 10H-82Z" fill="#fff5d4" stroke="#bc9356" stroke-width="2"/></g></svg><button type="button" class="archery-bow" data-archery-bow aria-label="Arrastra el arco hacia un globo y suelta para disparar." ${round.pending?'disabled':''}><svg viewBox="0 0 150 95" aria-hidden="true"><ellipse cx="75" cy="80" rx="63" ry="8" fill="#326e6a20"/><path class="bow-wood" d="M18 58Q75-25 132 58" fill="none" stroke="#97603c" stroke-width="9" stroke-linecap="round"/><path d="M20 57Q75-17 130 57" fill="none" stroke="#e3b46c" stroke-width="3"/><path class="bow-string" d="M18 58 75 70 132 58" fill="none" stroke="#fef5d0" stroke-width="3"/><path d="M75 75V17m0 0-7 12m7-12 7 12" fill="none" stroke="#7a5839" stroke-width="3"/></svg><span class="bow-grip" aria-hidden="true">⦿</span></button><div class="archery-feedback" role="status" aria-live="polite"></div></div></div>`;
}
function shootBalloon(button,aimPoint=null,gesture=null){
 const round=adventure,id=button?Number(button.dataset.id):-1;
 if(!round||!round.archeryStarted||!aimPoint||!gesture?.moved||gesture.round!==round||round.mode!=='archery'||round.done||round.pending)return;
 if(elapsedGameMs(round)>=round.archeryDeadline){updateArcheryCountdown();return;}
 cancelArcheryAim();round.pending=true;
 const correct=id===round.order[round.attempt%round.order.length];
 render();
 const field=document.querySelector('.archery-field'),target=field.querySelector(`[data-id="${id}"]`),body=target?.querySelector('.balloon-body');
 const rect=field.getBoundingClientRect(),balloon=body?.getBoundingClientRect();
 const start={x:rect.width/2,y:rect.height-43};
 const hit=balloon?{x:balloon.x+balloon.width/2-rect.x,y:balloon.y+balloon.height/2-rect.y}:{x:Math.max(0,Math.min(rect.width,aimPoint.x-rect.x)),y:Math.max(0,Math.min(rect.height,aimPoint.y-rect.y))};
 const control={x:(start.x+hit.x)/2,y:Math.min(start.y,hit.y)-25};
 const point=t=>({x:(1-t)**2*start.x+2*(1-t)*t*control.x+t*t*hit.x,y:(1-t)**2*start.y+2*(1-t)*t*control.y+t*t*hit.y});
 const frame=t=>{const p=point(t),ahead=point(t+.01),angle=Math.atan2(ahead.y-p.y,ahead.x-p.x)*180/Math.PI;return `translate(${p.x}px,${p.y}px) rotate(${angle}deg)`;};
 const arrow=field.querySelector('.archery-arrow'),motion=!calm&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 field.querySelector('.archery-flight').setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
 arrow.style.transform=frame(1);
 const bow=field.querySelector('.archery-bow'),rotation=Math.atan2(hit.y-start.y,hit.x-start.x)*180/Math.PI+90;
 bow.style.transform=`rotate(${rotation}deg)`;
 const reticle=field.querySelector('.archery-reticle');reticle.style.left=`${hit.x}px`;reticle.style.top=`${hit.y}px`;
 if(motion){
  archeryAnimations.push(arrow.animate(Array.from({length:21},(_,i)=>({transform:frame(i/20/.75),opacity:i<18?1:(20-i)/2,offset:i/20})),{duration:640,easing:'linear',fill:'forwards'}));
  const trail=field.querySelector('.archery-trail');trail.setAttribute('d',`M${start.x} ${start.y} Q${control.x} ${control.y} ${hit.x} ${hit.y}`);
  const length=trail.getTotalLength();trail.style.strokeDasharray=String(length);
  archeryAnimations.push(trail.animate([{strokeDashoffset:String(length),opacity:0},{strokeDashoffset:'0',opacity:.8,offset:.75},{strokeDashoffset:'0',opacity:0}],{duration:700,fill:'forwards'}));
  archeryAnimations.push(field.querySelector('.bow-string').animate([{transform:'translateY(15px)'},{transform:'translateY(-5px)'},{transform:'translateY(3px)'},{transform:'none'}],{duration:350}));
  archeryAnimations.push(bow.animate([{transform:`rotate(${rotation}deg) scale(.88)`},{transform:`rotate(${rotation}deg) scale(1.07)`},{transform:`rotate(${rotation}deg) scale(1)`}],{duration:350}));
 }
 SoundWorld.play('arrow');
 archeryImpactTimer=setTimeout(()=>{
  archeryImpactTimer=null;
  if(adventure!==round||screen!=='adventure'||!round.pending)return;
  target?.classList.add('is-hit',correct?'is-correct':'archery-miss');
  round.streak=correct?round.streak+1:0;
  round.notice=correct?(round.streak>1?`¡En el blanco! ×${round.streak}`:'¡En el blanco!'):target?'¡Ese no era! Vamos con otra palabra.':'¡Casi! Vamos con otra palabra.';
  field.querySelector('.archery-feedback').textContent=round.notice;
  field.querySelector('.archery-feedback').classList.add(correct?'is-correct':'archery-miss');
  if(!correct)round.mistakes++;
  if(target)SoundWorld.play('balloon-pop');
  SoundWorld.play(correct?(round.streak>1?'combo':'correct'):'wrong');
  if(motion&&target){
   const particles=field.querySelector('.archery-particles'),color=getComputedStyle(target).getPropertyValue('--balloon-color');
   particles.innerHTML=Array.from({length:16},(_,i)=>`<i style="left:${hit.x}px;top:${hit.y}px;background:${i%3?color:'#fff2b3'};--dx:${Math.cos(i*Math.PI/8)*(45+i*4)}px;--dy:${Math.sin(i*Math.PI/8)*(45+i*4)}px;--spin:${i*55}deg"></i>`).join('');
   particles.insertAdjacentHTML('beforeend',`<span class="archery-impact-ring" style="left:${hit.x}px;top:${hit.y}px"></span>`);
   if(correct)burst(balloon.x+balloon.width/2,balloon.y+balloon.height/2,12);
   archeryAnimations.push(field.animate([{transform:'translate(0)'},{transform:'translate(2px,-2px)'},{transform:'translate(-2px,1px)'},{transform:'translate(0)'}],{duration:180}));
  }
 },motion?480:80);
 gameTurnTimer=setTimeout(()=>{
  gameTurnTimer=null;
  if(adventure!==round||screen!=='adventure'||!round.pending)return;
  archeryAnimations.forEach(animation=>animation.cancel());archeryAnimations=[];
  advanceArcheryRound(round,correct);
 },motion?1150:650);
}
function totalStars(){return legacyStars()+islandLessons.reduce((sum,_,index)=>sum+islandStars(index),0);}
function islandStars(index){return progressionModes(index).reduce((sum,mode)=>sum+(islandProgress[`${index}-${mode}`]||0),0);}
function isGameUnlocked(index,mode,developerAccess=false){
 if(mode==='memory')return true;
 const modes=progressionModes(index),position=modes.indexOf(mode);
 return position>=0&&((developerAccess&&islandDevSettings.rightClickEntry)||islandProgress[`${index}-${mode}`]>0||modes.slice(0,position).every(previous=>islandProgress[`${index}-${previous}`]>0));
}
function startAdventure(index,mode=null,developerAccess=false){
 if(!islandLessons[index])return;
 const modes=progressionModes(index);
 if(!islandModes(index).includes(mode))mode=modes.find(candidate=>!islandProgress[`${index}-${candidate}`])||modes[0];
 const unfinished=modes.findIndex(candidate=>!islandProgress[`${index}-${candidate}`]);
 developerAccess=developerAccess&&islandDevSettings.rightClickEntry;
 if(!isGameUnlocked(index,mode,developerAccess)&&unfinished!==-1)mode=modes[unfinished];
 if(luceroRouteClosed(oceanIslands[index])&&!developerAccess){openLuceroGate();return;}
 if(isIslandLocked(oceanIslands[index])&&!developerAccess){lockedIslandIndex=index;cancelGameTurn();screen='locked';return;}
 cancelGameTurn();
 const wordIds=islandLessons[index].words.map(word=>word.id);
 const memoryVocabulary=mode==='memory'?memoryVocabularyForIsland(index):islandLessons[index].words;
 const memoryWords=shuffle(memoryVocabulary.map(word=>word.id));
 const connectWords=shuffle(wordIds).slice(0,Math.min(8,wordIds.length));
 const gameWords=mode==='connect'?connectWords:wordIds;
 adventure={index,mode,step:0,attempt:0,mistakes:0,turns:0,streak:0,matched:[],picks:[],notice:'',wrong:[],checked:false,pending:false,done:false,memorySeen:[],memoryMisses:[],memoryRecallHits:0,memoryRecallErrors:0,memoryVocabulary,memoryWords,target:mode==='memory'?memoryWords.length:mode==='connect'?connectWords.length:wordIds.length,order:shuffle(wordIds),left:shuffle(gameWords),right:shuffle(gameWords),deck:shuffle(Array.from({length:memoryWords.length*2},(_,id)=>({id,word:memoryWords[id%memoryWords.length],english:id<memoryWords.length})))};
 screen='adventure';
 adventure.developerAccess=developerAccess;
 adventure.coinMultiplier=islandCoinMultiplier(index);
 adventure.memoryReplay=mode==='memory'&&memoryBonusCompleted(index);
 adventure.startedAt=performance.now();adventure.pausedMs=0;adventure.pausedAt=document.hidden?adventure.startedAt:null;
 if(mode==='archery'){adventure.archeryStarted=false;return;}
 if(mode==='platforms'){adventure.platformStarted=false;return;}
 if(mode==='pirate'){adventure.pirateStarted=false;return;}
 if(mode==='blaster'){adventure.target=10;adventure.blasterStarted=false;adventure.blasterLives=3;adventure.blasterSession=`blaster-${++blasterSessionCounter}`;return;}
 startGameClock();
}
function finishAdventure(){
 const a=adventure;if(!a||a.done||(a.mode==='archery'&&!a.archeryStarted)||(a.mode==='platforms'&&!a.platformStarted)||(a.mode==='pirate'&&!a.pirateStarted)||(a.mode==='blaster'&&(!a.blasterStarted||a.step!==a.target)))return;
 a.durationMs=Math.round(elapsedGameMs(a));stopGameClock();
 recordCompletion(a);
 const reward=a.mode==='memory'?memoryReward(a):coinReward(a.mode,a.target,Math.floor(a.durationMs/1000));
 if(a.mode==='memory')a.memoryReplay=a.memoryReplay||a.previousBest!==null;
 const earnsCoins=a.earnsCoins;
 a.coins=earnsCoins?reward*a.coinMultiplier:0;
 a.coinsSaved=a.coins>0?awardCoins(a.coins):true;
 if(a.mode==='memory'){a.done=true;a.stars=0;a.newlyUnlocked=[];SoundWorld.play('win');return;}
 const wasComplete=islandComplete(a.index);
 const previousStars=totalStars();
 a.done=true;a.stars=a.mode==='blaster'?a.blasterLives:a.mistakes===0?3:a.mistakes<=2?2:1;
 const key=`${a.index}-${a.mode}`;islandProgress[key]=Math.max(islandProgress[key]||0,a.stars);
 a.newlyUnlocked=oceanIslands.flatMap((island,index)=>isIslandLocked(island,previousStars)&&!isIslandLocked(island)?[index]:[]);
 try{localStorage.setItem('ximena-islands-v1',JSON.stringify(islandProgress));progressSaved=true;}catch{progressSaved=false;}
 SoundWorld.play(a.newlyUnlocked.length?'treasure':'win');
 a.islandCompleted=a.mode===lastGameMode(a.index)&&islandComplete(a.index);a.justCompletedIsland=!wasComplete&&a.islandCompleted;
}
function cancelGameTurn(){
 cancelPlatforms();
 clearConnectDrag();
 cancelArcheryAim();
 clearTimeout(archeryImpactTimer);archeryImpactTimer=null;
 archeryAnimations.forEach(animation=>animation.cancel());archeryAnimations=[];
 stopGameClock();
 clearTimeout(gameTurnTimer);gameTurnTimer=null;
 if(adventure?.pending){adventure.pending=false;adventure.checked=false;adventure.wrong=[];adventure.picks=[];}
}
function scheduleGameTurn(round){
 clearTimeout(gameTurnTimer);
 gameTurnTimer=setTimeout(()=>{
  gameTurnTimer=null;
  if(adventure!==round||screen!=='adventure'||!round.pending)return;
  const restoreFocus=document.activeElement===document.body||document.activeElement?.dataset.play===round.mode;
  if(round.mode==='find'){
   if(round.checked)round.step++;
   round.left=reshuffle(round.left);
   round.notice=round.checked?'¡Siguiente palabra!':'Las tarjetas cambiaron de lugar. Inténtalo otra vez.';
  }else if(round.mode==='connect'){
   round.matched=[];round.picks=[];round.left=reshuffle(round.left);round.right=reshuffle(round.right);
   round.notice='Comienza de nuevo. Todas las parejas cambiaron de lugar.';
  }else{
   round.picks=[];round.notice='¡Busca otra pareja!';
  }
  round.pending=false;round.checked=false;round.wrong=[];
  if(round.mode==='find'&&round.step===round.target)finishAdventure();
  render();animateAdventure('advance',{dataset:{}},0);
  if(restoreFocus)document.querySelector(round.done?'[data-play="restart"]':`[data-play="${round.mode}"]:not(:disabled)`)?.focus({preventScroll:true});
 },500);
}
// Patch only changed nodes. The dialog, map, cards, focus and scroll stay mounted.
function patchGameNode(current,next){
 if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next.cloneNode(true));return;}
 if(current.nodeType===Node.TEXT_NODE){if(current.data!==next.data)current.data=next.data;return;}
 if(current.nodeType!==Node.ELEMENT_NODE)return;
 const sameArtwork=next.hasAttribute('data-static-art')&&current.dataset.staticArt===next.dataset.staticArt;
 for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
 for(const attr of next.attributes)if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
 // Marked artwork is immutable; retain its DOM and running CSS animations.
 if(sameArtwork)return;
 const key=node=>node.nodeType===1&&node.hasAttribute('data-play')?[node.dataset.play,node.dataset.id,node.dataset.side,node.dataset.mode].join(':'):null;
 const old=[...current.childNodes],used=new Set();
 [...next.childNodes].forEach((child,index)=>{
  const childKey=key(child);
  let existing=childKey?old.find(node=>!used.has(node)&&key(node)===childKey):old[index];
  if(existing&&(used.has(existing)||(!childKey&&key(existing))))existing=null;
  if(existing){used.add(existing);if(current.childNodes[index]!==existing)current.insertBefore(existing,current.childNodes[index]||null);patchGameNode(existing,child);}
  else current.insertBefore(child.cloneNode(true),current.childNodes[index]||null);
 });
 for(const node of old)if(!used.has(node)&&node.parentNode===current)node.remove();
}
function updateAdventure(){
 invalidatePlatformView();
 syncCoinHud();
 const template=document.createElement('template');template.innerHTML=adventureView();
 const dialog=document.querySelector('.screen-overlay');
 patchGameNode(dialog.querySelector(':scope > header'),template.content.querySelector('header'));
 patchGameNode(dialog.querySelector('.island-game'),template.content.querySelector('.island-game'));
 syncIslandRoom();
 syncMemoryText();
 const audio=dialog.querySelector('.overlay-audio');audio.textContent=muted?'♪ ×':'♪ ✓';audio.setAttribute('aria-label',muted?'Activar sonido':'Silenciar sonido');
 document.querySelectorAll('.hud-stars b').forEach(el=>el.textContent=totalStars());
 document.querySelectorAll('.map-node.is-locked').forEach(node=>{
  const index=Number(node.dataset.island),island=oceanIslands[index];
  if(!isIslandLocked(island)){node.classList.remove('is-locked');node.textContent=index+1;node.setAttribute('aria-label',`Jugar en ${island.name}`);}
 });
 document.querySelectorAll('.scenic-locked').forEach(node=>{
  const island=oceanIslands.find(item=>item.type===node.dataset.island);
  if(island&&!isIslandLocked(island))node.classList.remove('scenic-locked');
 });
 SoundWorld.sync();
}
function animateAdventure(action,button,oldCount){
 const a=adventure;
 const motion=!calm&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animate=(el,frames,duration=360)=>{
  if(!el||!motion)return;
  el.getAnimations().filter(animation=>!animation.animationName).forEach(animation=>animation.cancel());
  el.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.25,1)'});
 };
 const cards=[...document.querySelectorAll('.island-game [data-id]')];
 const same=cards.find(el=>el.dataset.play===action&&el.dataset.id===button.dataset.id&&el.dataset.side===button.dataset.side);
 if(a.wrong.length){
  document.querySelectorAll('.is-wrong').forEach(el=>animate(el,[{transform:'translateX(0)'},{transform:'translateX(-7px)'},{transform:'translateX(7px)'},{transform:'translateX(-4px)'},{transform:'translateX(0)'}]));
 }else if(a.done){
  if(motion){const box=document.querySelector('.island-result').getBoundingClientRect();burst(box.x+box.width/2,box.y+100,28);}
 }else if(action==='memory'){
  if(a.matched.length>oldCount){
   const word=a.deck.find(card=>card.id===Number(button.dataset.id)).word;
   a.deck.filter(card=>card.word===word).forEach(card=>animate(document.querySelector(`[data-play="memory"][data-id="${card.id}"]`),[{transform:'translateY(0)'},{transform:'translateY(-7px) scale(1.04)'},{transform:'translateY(0)'}],450));
  }
 }else if(action==='connect'){
  if(a.matched.length>oldCount){document.querySelectorAll('.pair-card.is-matched').forEach(el=>{if(el.dataset.id===button.dataset.id)animate(el,[{transform:'scale(.94)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],440);});}
  animate(same,[{transform:'scale(.95)'},{transform:'scale(1.04)'},{transform:'scale(1)'}]);
 }else if(action==='advance'){
  if(a.mode==='connect')document.querySelectorAll('.pair-card').forEach((el,i)=>animate(el,[{transform:`translateX(${i<a.left.length?-14:14}px) scale(.96)`},{transform:'translateX(0) scale(1)'}],350));
  animate(document.querySelector('.island-game .word'),[{transform:'translateY(8px)'},{transform:'translateY(0)'}],260);
 }
 if(!a.done&&a.matched.length+Number(a.checked)>oldCount){
  const good=same||document.querySelector('.is-known,.is-matched');
  if(good&&motion){const box=good.getBoundingClientRect();burst(box.right-25,box.top+25,9);}
  animate(document.querySelector('.lesson-track'),[{filter:'brightness(1)'},{filter:'brightness(1.2)'},{filter:'brightness(1)'}]);
 }
}
function lessonStatusView(round,count){
 if(['find','connect','memory'].includes(round.mode))return '';
 const detail=round.mode==='platforms'?' rescates':['archery','pirate'].includes(round.mode)?' aciertos':'';
 return `<div class="lesson-status"><span>${gameModes[round.mode]} · ${count} / ${round.target}${detail}</span><span class="game-clock" role="timer" aria-label="Tiempo de partida"><span aria-hidden="true">◷</span> <time>${gameTime(elapsedGameMs(round))}</time></span></div>`;
}
function adventureView(){
 const a=adventure,lesson=islandLessons[a.index],name=oceanIslands[a.index].name;
 const count=['find','archery','platforms','pirate','blaster'].includes(a.mode)?a.step:a.matched.length;
 let content='';
 if(a.done&&a.mode==='memory'){
  content=`<div class="island-result"><div class="lesson-icon">${goldCoinIcon()}</div><h2>¡Bonus completado!</h2>${a.memoryReplay?'<p>Ya habías completado este bonus en esta isla. Esta partida no otorga monedas.</p>':coinRewardView(a)}${resultActions()}</div>`;
 }else if(a.done){
  content=`<div class="island-result"><div class="lesson-icon">${lesson.words[0].icon}</div><h2>${a.islandCompleted?'¡Isla completada!':`¡Completaste ${gameModes[a.mode]}!`}</h2>${a.justCompletedIsland&&nextIslands(a.index).length>0?'<div class="island-complete-seal" aria-label="Isla completada"><span aria-hidden="true">⚓</span><i></i><i></i><i></i></div>':''}<div class="earned-stars" role="img" aria-label="${a.stars} de 3 estrellas">${[1,2,3].map(n=>`<span class="result-star ${n<=a.stars?'is-earned':'is-unearned'}" style="--star-index:${n-1}" aria-hidden="true">★</span>`).join('')}</div>${coinRewardView(a)}${a.coinImprovementLimitReached?'<p role="status">Ya alcanzaste las 3 mejoras con monedas para este juego en esta isla.</p>':''}${unlockCelebration(a.newlyUnlocked,a.unlockDismissed)}${resultActions()}</div>`;
 }else if(a.mode==='find'){
  const word=lesson.words[a.order[a.step]];
  content=`<h2 class="word">${word.en}</h2><div class="lesson-grid find-grid">${a.left.map(id=>{const w=lesson.words[id];return `<button class="lesson-card ${a.checked&&id===word.id?'is-known':''} ${a.wrong.includes(id)?'is-wrong':''}" data-play="find" data-id="${id}" ${a.pending?'disabled':''}><span class="lesson-icon" aria-hidden="true">${w.icon}</span><b>${w.es}</b></button>`;}).join('')}</div>`;
 }else if(a.mode==='connect'){
  content=`<div class="connect-board">${connectLinks(a)}${['left','right'].map(side=>`<div>${a[side].map(id=>`<button class="pair-card ${a.matched.includes(id)?'is-matched':''} ${a.picks.includes(`${side}-${id}`)?'is-picked':''} ${a.wrong.includes(`${side}-${id}`)?'is-wrong':''}" data-play="connect" data-side="${side}" data-id="${id}" aria-pressed="${a.picks.includes(`${side}-${id}`)}" ${a.pending||a.matched.includes(id)?'disabled':''}><span class="pair-orb" aria-hidden="true">${a.matched.includes(id)?'✓':a.picks.includes(`${side}-${id}`)?'•':'◇'}</span><span class="pair-word">${lesson.words[id][side==='left'?'en':'es']}</span></button>`).join('')}</div>`).join('')}</div>`;
 }else{
  content=a.mode==='blaster'?blasterView(a):a.mode==='pirate'?pirateView(a,lesson):a.mode==='platforms'?platformView(a,lesson):a.mode==='archery'?archeryView(a,lesson):memoryView(a);
 }
 return `${header(`${name} ${islandCoinBadge(a.index)}`,lesson.topic)}<section class="island-game"><ol class="lesson-modes" aria-label="Juegos de la isla">${islandModes(a.index).map(mode=>[mode,gameModes[mode]]).map(([mode,label])=>`<li><button class="lesson-mode" data-play="mode" data-mode="${mode}" aria-pressed="${a.mode===mode}" ${isGameUnlocked(a.index,mode,a.developerAccess)?'':'disabled'}><span>${mode==='memory'?'':`${progressionModes(a.index).indexOf(mode)+1}. `}${label}${isGameUnlocked(a.index,mode,a.developerAccess)?'':' <span aria-label="Bloqueado">🔒</span>'}</span>${modeStars(a.index,mode)}</button></li>`).join('')}</ol>${islandLineupSaved?'':'<p role="status">No se pudo guardar el sorteo. Permite el almacenamiento para conservar los juegos al volver.</p>'}${!a.done&&a.mode!=='blaster'&&(a.mode!=='archery'||a.archeryStarted)&&(a.mode!=='platforms'||a.platformStarted)&&(a.mode!=='pirate'||a.pirateStarted)?`${lessonStatusView(a,count)}<div class="lesson-track" role="progressbar" aria-label="Progreso del juego" aria-valuemin="0" aria-valuemax="${a.target}" aria-valuenow="${count}"><span style="width:${count/a.target*100}%"></span>${Array.from({length:a.target},(_,i)=>i+1).map(n=>`<i class="${count>=n?'is-filled':''}" aria-hidden="true">${count>=n?(a.mode==='memory'?'✓':'★'):'·'}</i>`).join('')}</div>`:''}${content}<span class="game-announcement" role="status" aria-live="polite" aria-atomic="true">${a.notice}</span></section>`;
}
function handleAdventure(button){
 const a=adventure,action=button.dataset.play,id=Number(button.dataset.id);if(!a||button.disabled)return;
 if(action==='unlock-close'&&a.done){a.unlockDismissed=true;render();document.querySelector('[data-play="restart"]')?.focus({preventScroll:true});return;}
 if(action==='route'&&a.done&&a.mode===lastGameMode(a.index)&&islandComplete(a.index)){
  const destination=Number(button.dataset.destination);
  if(nextIslands(a.index).includes(destination)){if(luceroRouteClosed(oceanIslands[destination]))openLuceroGate();else voyageToIsland(a.index,destination);}
  return;
 }
 if(action==='archery-start'){beginArchery();return;}
 if(action==='platform-start'){beginPlatforms();return;}
 if(action==='pirate-start'){beginPirate();return;}
 if(action==='pirate-choice'){choosePirate(Number(button.dataset.side));return;}
 if(action==='platform-control')return;
 if(action==='archery')return;
 const oldCount=a.matched.length+Number(a.checked);
 a.wrong=[];
 if(action==='mode'){
  if(!isGameUnlocked(a.index,button.dataset.mode,a.developerAccess)||(button.dataset.mode===a.mode&&!a.done))return;
  startAdventure(a.index,button.dataset.mode,a.developerAccess);render();return;
 }
 if(action==='restart')startAdventure(a.index,a.mode,a.developerAccess);
 else if(action==='next'&&a.done){const modes=progressionModes(a.index),next=modes.indexOf(a.mode)+1;if(next<modes.length){startAdventure(a.index,modes[next],a.developerAccess);}else if(!islandComplete(a.index)){startAdventure(a.index,progressionModes(a.index).find(mode=>!islandProgress[`${a.index}-${mode}`]),a.developerAccess);}else if(nextIslands(a.index).length===1){voyageToIsland(a.index,nextIslands(a.index)[0]);return;}else if(nextIslands(a.index).length>1){render();return;}else{screen='map';render();return;}}
 else if(a.done)return;
 else if(action==='find'&&!a.pending){a.pending=true;if(id===a.order[a.step]){a.checked=true;a.notice='¡Correcto! Sigue así.';SoundWorld.play('correct');}else{a.wrong=[id];a.mistakes++;a.notice='Todavía no. Mira las opciones y prueba de nuevo.';SoundWorld.play('wrong');}}
 else if(action==='connect'&&!a.matched.includes(id)){
 const side=button.dataset.side;if(!a.picks.length||a.picks[0].startsWith(side))SoundWorld.play('tap');a.picks=a.picks.filter(p=>!p.startsWith(side));a.picks.push(`${side}-${id}`);a.notice='Busca su traducción.';
 if(a.picks.length===2){if(a.picks[0].split('-')[1]===a.picks[1].split('-')[1]){a.matched.push(id);a.notice='¡Una pareja más!';SoundWorld.play('correct');}else{a.wrong=[...a.picks];a.pending=true;a.mistakes++;a.notice='Estas palabras no son pareja. Inténtalo de nuevo.';SoundWorld.play('wrong');}a.picks=[];if(a.matched.length===a.target)finishAdventure();}
 }else if(action==='memory'&&a.picks.length<2&&!a.picks.includes(id)){
 const card=a.deck.find(c=>c.id===id);if(!card||a.matched.includes(card.word)||a.pending)return;
 if(a.picks.length===1){
  const first=a.deck.find(c=>c.id===a.picks[0]),mate=a.deck.find(c=>c.word===first.word&&c.id!==first.id);
  const knownMate=a.memorySeen.includes(mate.id),missKey=[first.id,id].sort((x,y)=>x-y).join(':');
  if(card.word===first.word){if(knownMate)a.memoryRecallHits++;}
  else{if(knownMate||a.memoryMisses.includes(missKey))a.memoryRecallErrors++;a.memoryMisses.push(missKey);}
 }
 if(!a.memorySeen.includes(id))a.memorySeen.push(id);
 a.picks.push(id);SoundWorld.play('flip');a.notice='';
 if(a.picks.length===2){a.turns++;const pair=a.picks.map(p=>a.deck.find(c=>c.id===p));if(pair[0].word===pair[1].word){a.streak++;a.matched.push(card.word);a.picks=[];a.notice=`¡Pareja encontrada! ${a.streak} seguidas.`;SoundWorld.play(a.streak>1?'combo':'correct');if(a.matched.length===a.target)finishAdventure();}else{a.wrong=[...a.picks];a.pending=true;a.mistakes++;a.streak=0;a.notice='Mira las dos palabras antes de volver a ocultarlas.';SoundWorld.play('wrong');}}
 }
 render();
 animateAdventure(action,button,oldCount);
 if(a.pending){scheduleGameTurn(a);return;}
 const candidates=[...document.querySelectorAll('.island-game button:not(:disabled):not([hidden])')];
 const same=candidates.find(el=>el.dataset.play===action&&el.dataset.id===button.dataset.id&&el.dataset.side===button.dataset.side&&el.dataset.mode===button.dataset.mode);
 (document.querySelector('.unlock-close')||same||document.querySelector('.result-action,.island-game .primary:not([hidden])')||candidates[0])?.focus({preventScroll:true});
}
function islandCollectionView(){return `${header('Mis tesoros de las islas','TU PROGRESO')}<p>Gana hasta ${starsPerIsland()} estrellas por isla completando los ${MAIN_GAMES_PER_ISLAND} juegos principales. Memoria es un bonus de monedas. Se conserva tu mejor resultado.${legacyStars()?` Conservas además ${legacyStars()} estrellas de juegos anteriores.`:''}</p><div class="lesson-grid treasure-grid">${islandLessons.map((lesson,index)=>`<button class="lesson-card ${isIslandLocked(oceanIslands[index])?'is-locked':''}" data-lesson="${index}" aria-label="${oceanIslands[index].name}${isIslandLocked(oceanIslands[index])?', bloqueada':''}"><span class="lesson-icon" aria-hidden="true">${isIslandLocked(oceanIslands[index])?'🔒':islandStars(index)?lesson.words[0].icon:'🏝️'}</span><b>${oceanIslands[index].name}</b><span>${lesson.topic}</span><strong>⭐ ${islandStars(index)} / ${starsPerIsland()}</strong><small>${progressionModes(index).filter(mode=>islandProgress[`${index}-${mode}`]).length} / ${MAIN_GAMES_PER_ISLAND} juegos completados</small></button>`).join('')}</div>`;}

// Banderas: one clock drives every phase and pauses with the shared game clock.
function beginPirate(){
 const round=adventure;
 if(screen!=='adventure'||round?.mode!=='pirate'||round.pirateStarted||round.done)return;
 round.pirateStarted=true;round.startedAt=performance.now();round.pausedMs=0;round.pausedAt=document.hidden?round.startedAt:null;
 preparePirateRound(round);startGameClock();
 SoundWorld.play('tap');document.querySelector('.pirate-game')?.focus({preventScroll:true});
}
function preparePirateRound(round){
 const words=islandLessons[round.index].words,word=words[round.order[round.attempt%round.order.length]];
 const picture=value=>value.replace(/[\uFE0E\uFE0F]/g,'');
 const other=shuffle(words.filter(candidate=>candidate.id!==word.id&&candidate.en!==word.en&&picture(candidate.icon)!==picture(word.icon)))[0];
 const correctSide=Math.random()<.5?0:1;
 const now=elapsedGameMs(round),answerWindow=3000-Math.min(round.step,7)*100;
 round.pirate={phase:'choose',phaseAt:now,window:answerWindow,deadline:now+answerWindow,word:word.id,options:correctSide?[other.id,word.id]:[word.id,other.id],correctSide,selected:null,outcome:false};
 round.pending=false;round.notice='Elige una bandera.';render();
}
function choosePirate(side){
 const round=adventure,p=round?.pirate;
 if(screen!=='adventure'||round?.mode!=='pirate'||round.done||!round.pirateStarted||document.hidden||p?.phase!=='choose'||![0,1].includes(side))return;
 if(elapsedGameMs(round)>=p.deadline){resolvePirate(round,null);return;}
 resolvePirate(round,side);
}
function resolvePirate(round,side){
 const p=round.pirate;if(p.phase!=='choose')return;
 p.selected=side;p.outcome=side===p.correctSide;p.phase=p.outcome?'success':'miss';p.phaseAt=elapsedGameMs(round);round.pending=true;
 if(p.outcome){round.streak++;round.notice='¡Muy bien!';SoundWorld.play(round.streak>1?'combo':'correct');}
 else{round.mistakes++;round.streak=0;round.notice=side===null?'¡Se acabó el tiempo!':'¡Ups!';SoundWorld.play('pirate-swish');}
 render();
}
function updatePirateRound(){
 const round=adventure,p=round?.pirate;
 if(screen!=='adventure'||round?.mode!=='pirate'||!round.pirateStarted||round.done||!p||document.hidden)return;
 const now=elapsedGameMs(round),age=now-p.phaseAt;
 if(p.phase==='choose'){
  if(now>=p.deadline){resolvePirate(round,null);return;}
  const meter=document.querySelector('.pirate-time');
  if(meter){const remaining=Math.max(0,p.deadline-now);meter.querySelector('i').style.transform=`scaleX(${remaining/p.window})`;meter.setAttribute('aria-valuenow',String(Math.ceil(remaining/1000)));meter.classList.toggle('is-urgent',remaining<1500);}
 }else if(p.phase==='miss'&&age>=800){
  p.phase='correct';p.phaseAt=now;const word=islandLessons[round.index].words[p.word];round.notice=`${word.en}: ${word.es}.`;render();
 }else if((p.phase==='success'&&age>=1100)||(p.phase==='correct'&&age>=2000)){
  advanceRoundAttempt(round,p.outcome);round.pending=false;
  if(round.step>=round.target){finishAdventure();render();document.querySelector('[data-play="restart"]')?.focus({preventScroll:true});}
  else preparePirateRound(round);
 }
}
document.addEventListener('keydown',event=>{
 if(!event.target.closest?.('.pirate-game')||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
 const side={ArrowLeft:0,a:0,A:0,ArrowRight:1,d:1,D:1}[event.key];
 if(side!==undefined){event.preventDefault();choosePirate(side);}
});
function pirateCaptain(){return `<svg data-static-art="pirate-captain" class="pirate-captain" viewBox="0 0 320 340" aria-hidden="true">
 <ellipse cx="160" cy="323" rx="85" ry="12" fill="#284f6130"/>
 <g class="captain-body">
 <g class="captain-arm captain-arm-left"><path d="M113 210Q78 245 33 196" stroke="#294d70" stroke-width="32" fill="none" stroke-linecap="round"/><path d="m35 200-12-11" stroke="#fff1d1" stroke-width="27" stroke-linecap="round"/><ellipse cx="16" cy="181" rx="14" ry="17" fill="#f0b989"/><path d="M12 173v15m7-16v14" stroke="#d58e6b" stroke-width="2" stroke-linecap="round"/></g>
 <g class="captain-arm captain-arm-right"><path d="M207 210Q242 245 287 196" stroke="#294d70" stroke-width="32" fill="none" stroke-linecap="round"/><path d="m285 200 12-11" stroke="#fff1d1" stroke-width="27" stroke-linecap="round"/><ellipse cx="304" cy="181" rx="14" ry="17" fill="#f0b989"/></g>
 <path d="m119 267-8 42 38 1 11-40m2 0 9 40 39-1-10-42" fill="#607e8e"/><path d="M110 300h38v24H95q-6-15 15-17m62-7h38l15 9q11 5 5 15h-58Z" fill="#34485d"/><path d="M115 300h28m34 0h28" stroke="#dfaf6d" stroke-width="5"/>
 <path d="M121 181Q160 163 199 181l18 99q-55 24-115 0Z" fill="#fff0d2"/><path d="M115 193h90m-96 22h104m-107 21h108" stroke="#d98777" stroke-width="9"/><path d="M118 177l31 12-13 103-35-11zm84 0-31 12 13 103 35-11" fill="#35577c" stroke="#edc276" stroke-width="5"/>
 <path d="M105 257q57 12 111 0v20q-53 12-111 0Z" fill="#785448"/><rect x="147" y="256" width="30" height="26" rx="5" fill="#edbd68"/><rect x="154" y="262" width="16" height="13" rx="2" fill="#785448"/>
 <g class="captain-head"><path d="M90 109Q78 177 114 183h92q34-21 23-79" fill="#895641"/><ellipse cx="97" cy="130" rx="16" ry="22" fill="#e8a17c"/><ellipse cx="223" cy="130" rx="16" ry="22" fill="#e8a17c"/><circle cx="224" cy="152" r="10" fill="none" stroke="#f3c76b" stroke-width="5"/>
 <path d="M104 87Q160 49 216 87v51q-3 54-56 55-54-2-56-55Z" fill="#f5c396"/><path d="M108 133q4 49 52 49 39 0 54-35-5 45-54 46-50-2-56-54" fill="#eaaa84"/>
 <ellipse cx="120" cy="147" rx="13" ry="7" fill="#e99582" opacity=".65"/><ellipse cx="201" cy="147" rx="12" ry="7" fill="#e99582" opacity=".65"/>
 <g class="captain-eye"><ellipse cx="134" cy="128" rx="6" ry="9" fill="#3d4d59"/><circle cx="136" cy="125" r="2" fill="#fff9e2"/></g><path class="captain-brow" d="M122 112q10-7 22 0" stroke="#8d5944" stroke-width="5" stroke-linecap="round" fill="none"/>
 <path d="m112 97 100 35" stroke="#35485a" stroke-width="5"/><path d="M169 116q16-9 31 3l-3 20q-23 13-29-7Z" fill="#35485a"/><path d="m177 121 13 4" stroke="#597386" stroke-width="3" stroke-linecap="round"/>
 <path d="M157 127q-8 15 5 15" fill="none" stroke="#d38e6c" stroke-width="4" stroke-linecap="round"/>
 <path class="captain-smile" d="M140 155q20 26 39 0Z" fill="#85594e"/><path class="captain-smile" d="M145 156h29l-4 7h-20Z" fill="#fff5db"/>
 <path class="captain-pout" d="M146 164q14-12 28 0" stroke="#98604d" stroke-width="5" fill="none" stroke-linecap="round"/>
 <path d="M95 97Q159 70 225 98l-5 18q-59-23-120-2Z" fill="#d77969"/><path d="m218 101 34 27-30-1 13 23-28-10Z" fill="#cf6c62"/>
 <path d="M64 92Q86 61 99 75q4-57 61-61 56 4 62 61 14-13 35 17-91 29-193 0Z" fill="#304c6b" stroke="#edbf72" stroke-width="6" stroke-linejoin="round"/>
 <path d="M113 63q11-34 44-35" fill="none" stroke="#607e99" stroke-width="5" stroke-linecap="round"/><path d="m161 45 6 12 14 2-10 10 2 14-12-7-13 7 3-14-10-10 14-2Z" fill="#ffe0a1"/>
 </g>
 <g class="captain-strike-arm"><g class="captain-blade-trail" fill="none" stroke-linecap="round"><path pathLength="1" d="M360 62A132 132 0 0 0 174 209" stroke="#92e1e5" stroke-width="17" opacity=".35"/><path pathLength="1" d="M350 65A124 124 0 0 0 183 205" stroke="#fff5cc" stroke-width="9"/><path pathLength="1" d="M340 73A114 114 0 0 0 191 203" stroke="#fffdf1" stroke-width="3"/></g><path d="M207 210Q242 245 287 196" stroke="#294d70" stroke-width="32" fill="none" stroke-linecap="round"/><path d="m285 200 12-11" stroke="#fff1d1" stroke-width="27" stroke-linecap="round"/><g class="captain-weapon-wrist"><g class="captain-sword" transform="translate(6 -19)"><path d="M299 183Q283 122 304 73l16-26q-3 80-21 136Z" fill="#dff6ec" stroke="#7396a5" stroke-width="4" stroke-linejoin="round"/><path d="m305 77-7 88" stroke="#fffdf0" stroke-width="4"/><path d="M284 181q15 15 32-1" fill="none" stroke="#efc171" stroke-width="9" stroke-linecap="round"/><path d="m298 190-4 28" stroke="#8a5c45" stroke-width="10" stroke-linecap="round"/><circle cx="293" cy="218" r="7" fill="#e9ba68"/></g><ellipse cx="304" cy="181" rx="11" ry="13" fill="#f0b989" stroke="#d5926c" stroke-width="2"/><path d="M298 177h11m-11 5h11" stroke="#d5926c" stroke-width="2" stroke-linecap="round"/></g></g>
 </g></svg>`;}
function pirateFlag(word,side,p){
 const corrected=p&&['success','correct'].includes(p.phase),right=corrected&&side===p.correctSide;
 return `<div class="pirate-flag flag-${side?'right':'left'} ${right?'flag-correct':''} ${corrected&&!right?'flag-muted':''}"><div class="flag-cloth"><span class="flag-picture" role="img" aria-label="${word.es}">${word.icon}</span><b class="flag-check" aria-hidden="true">✓</b></div><i class="flag-pole" aria-hidden="true"></i></div>`;
}
function pirateView(round,lesson){
 const p=round.pirate,started=round.pirateStarted,word=lesson.words[started?p.word:round.order[0]];
 const phase=started?p.phase:'intro';
 const options=started?p.options: [word.id,lesson.words.find(w=>w.icon!==word.icon).id];
 const correct=started&&phase==='correct';
 return `<div class="pirate-game pirate-${phase}" tabindex="-1" role="group" aria-label="Banderas del pirata"><div class="pirate-heading"><span class="pirate-kicker">${started?'CAPITÁN BRISA':'BANDERAS DEL PIRATA'}</span><h2 class="pirate-word">${started?word.en:'¡Elige tu bandera!'}</h2>${!started?'<p>Mira la palabra. Toca el lado de su imagen.</p>':''}</div>
 <div class="pirate-stage"><div class="pirate-sea" aria-hidden="true"><i></i><i></i></div><div class="pirate-deck" aria-hidden="true"></div><div class="pirate-ropes" aria-hidden="true"></div>${pirateCaptain()}${options.map((id,side)=>pirateFlag(lesson.words[id],side,started?p:null)).join('')}

 <div class="pirate-confetti" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--piece:${i};--confetti-x:${-190+i*35}px;--confetti-y:${-100+(i%4)*40}px">${i%3?'✦':'●'}</i>`).join('')}</div><div class="pirate-reaction" role="status">${phase==='success'?'¡Muy bien! ★':phase==='miss'?'¡Ups!':correct?`<span aria-hidden="true">${word.icon}</span> ${word.en} <small>${word.es}</small>`:''}</div></div>
 ${started?`<div class="pirate-time" role="progressbar" aria-label="Tiempo para elegir" aria-valuemin="0" aria-valuemax="${Math.ceil(p.window/1000)}" aria-valuenow="${phase==='choose'?Math.ceil(Math.max(0,p.deadline-elapsedGameMs(round))/1000):Math.ceil(p.window/1000)}"><i></i></div><div class="pirate-controls">${[0,1].map(side=>`<button type="button" class="pirate-choice choice-${side?'right':'left'}" data-play="pirate-choice" data-side="${side}" ${phase!=='choose'?'disabled':''} aria-label="Elegir la bandera ${side?'derecha':'izquierda'}"><span aria-hidden="true">${side?'→':'←'}</span><b>${side?'Derecha':'Izquierda'}</b></button>`).join('')}</div>`:'<div class="pirate-start-panel"><span>8 aciertos · toca izquierda o derecha</span><button class="primary" data-play="pirate-start">¡A jugar! <span aria-hidden="true">➜</span></button></div>'}
 </div>`;
}

// The imported canvas game lives in its own document; removing the frame releases its loop and graphics.
function blasterView(round){return `<iframe class="blaster-frame" data-play="blaster-frame" data-id="${round.blasterSession}" title="Escribe: palabras y asteroides" src="/blaster.html?session=${round.blasterSession}"></iframe>`;}
window.addEventListener('message',event=>{
 const a=adventure,frame=document.querySelector('.blaster-frame'),data=event.data;
 if(screen!=='adventure'||a?.mode!=='blaster'||a.done||event.source!==frame?.contentWindow||event.origin!==location.origin||data?.game!=='blaster'||data.session!==a.blasterSession)return;
 if(data.type==='ready'){frame.contentWindow.postMessage({type:'configure',words:islandLessons[a.index].words},location.origin);return;}
 if(data.type==='exit'){screen='map';render();return;}
 if(data.type==='start'){a.blasterStarted=true;a.blasterRunning=true;a.blasterLives=3;a.step=0;a.mistakes=0;a.startedAt=performance.now();a.pausedMs=0;a.pausedAt=document.hidden?a.startedAt:null;frame.scrollIntoView({block:'center',behavior:'instant'});SoundWorld.play('tap');return;}
 if(!a.blasterRunning||document.hidden)return;
 if(data.type==='sound'){if(['blaster-laser','blaster-explosion','blaster-crash','wrong'].includes(data.sound))SoundWorld.play(data.sound);}
 else if(data.type==='mistake')a.mistakes++;
 else if(data.type==='progress'&&data.score===a.step+1&&data.score<=a.target)a.step=data.score;
 else if(data.type==='loss'){a.blasterRunning=false;a.pausedAt=performance.now();}
 else if(data.type==='win'&&a.step===a.target&&Number.isInteger(data.lives)&&data.lives>=1&&data.lives<=3){a.blasterLives=data.lives;a.blasterRunning=false;finishAdventure();render();}
});
