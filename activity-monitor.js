/* Independent, best-effort journal. It never changes the game's saved progress. */
(() => {
 'use strict';
 const cfg=window.XimenaMonitorConfig||{}, PREFIX='ximena-monitor-', DB='ximena-monitor-v1';
 const testing=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('monitor-test');
 const ipad=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
 const enabled=testing||(ipad&&standalone);
 const id=()=>crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
 const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const write=(key,value)=>{try{localStorage.setItem(key,value);return true;}catch{return false;}};
 const initialSave={};
 try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('ximena-')&&!key.startsWith(PREFIX))initialSave[key]=localStorage.getItem(key);}}catch{}
 let deviceId=read(PREFIX+'device');if(!deviceId){deviceId=id();write(PREFIX+'device',deviceId);}
 let database,session=null,lastInput=Date.now(),lastTick=Date.now(),context={},round=null,cloudStatus='local';
 let pending=Promise.resolve(),opening;
 const held=new Set();
 const notify=()=>window.dispatchEvent(new CustomEvent('ximena-monitor-change'));
 const open=()=>opening||=(new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return;}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{for(const name of ['events','backups','meta'])req.result.createObjectStore(name,{keyPath:'id'});};
  req.onsuccess=()=>{database=req.result;database.onversionchange=()=>database.close();resolve(database);};
  req.onerror=()=>reject(req.error);
 }));
 async function operation(store,mode,action){
  const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction(store,mode),request=action(tx.objectStore(store));let result;
   if(request)request.onsuccess=()=>{result=request.result;};
   tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
 }
 async function persist(record){
  await operation('events','readwrite',store=>store.put(record));
  try{localStorage.removeItem(PREFIX+'pending:'+record.id);}catch{}
 }
 function record(kind,payload={},at=Date.now()){
  if(!enabled)return null;
  const event={id:id(),schema:1,kind,at,sessionId:session?.id||'none',payload:JSON.stringify(payload),uploaded:false};
  // A synchronous, per-event spool covers reloads before IndexedDB finishes.
  write(PREFIX+'pending:'+event.id,JSON.stringify(event));
  pending=pending.then(()=>persist(event)).catch(()=>{cloudStatus='storage-error';notify();});
  notify();return event.id;
 }
 function progress(){
  const parse=(key,fallback)=>{try{return JSON.parse(read(key)||'null')??fallback;}catch{return fallback;}};
  return {coins:Number(read('ximena-coins-v1')||0),stars:parse('ximena-islands-v1',{}),bestTimes:parse('ximena-best-times-v1',{}),routes:parse('ximena-lucero-routes-v1',[])};
 }
 async function backup(){
  if(!enabled)return;
  const db=await open();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('backups','readwrite'),store=tx.objectStore('backups'),request=store.get('initial');
   request.onsuccess=()=>{if(!request.result)store.add({id:'initial',at:Date.now(),appVersion:document.querySelector('meta[name="app-version"]')?.content||'unknown',values:initialSave,uploaded:false});};
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
 }
 function tick(now=Date.now()){
  if(!session){lastTick=now;return;}
  // Never count a suspended browser's unobserved gap as proven play time.
  const elapsed=Math.max(0,Math.min(now-lastTick,15000)),from=now-elapsed;
  const activeUntil=held.size?now:lastInput+(cfg.idleMs||120000);
  const active=Math.max(0,Math.min(now,activeUntil)-from);
  if(elapsed>0){session.totalMs+=elapsed;session.activeMs+=active;session.idleMs+=elapsed-active;}
  lastTick=now;
  return {from,to:now,totalMs:elapsed,activeMs:active,idleMs:elapsed-active};
 }
 let intervals=[];
 function sample(now=Date.now()){const value=tick(now);if(value?.totalMs)intervals.push(value);if(held.size)lastInput=now;}
 function checkpoint(reason='minute'){
  sample();
  if(!session)return;
  if(intervals.length){
   const parts=intervals;intervals=[];
   record('activity',{intervals:parts,reason});
  }
  record('checkpoint',{...context,...progress(),totalMs:session.totalMs,activeMs:session.activeMs,idleMs:session.idleMs,state:isActive()?'active':'idle',reason});
  write(PREFIX+'checkpoint',JSON.stringify({id:session.id,at:Date.now(),totalMs:session.totalMs,activeMs:session.activeMs,idleMs:session.idleMs}));
 }
 function isActive(){return Boolean(session&&!document.hidden&&(held.size||Date.now()-lastInput<(cfg.idleMs||120000)));}
 function start(){
  if(!enabled||document.hidden||session)return;
  session={id:id(),startedAt:Date.now(),totalMs:0,activeMs:0,idleMs:0};lastTick=lastInput=Date.now();intervals=[];
  record('session_start',{...context});
 }
 function end(reason){
  if(!session)return;
  checkpoint(reason);
  record('session_end',{reason,totalMs:session.totalMs,activeMs:session.activeMs,idleMs:session.idleMs});
  session=null;held.clear();try{localStorage.removeItem(PREFIX+'checkpoint');}catch{}
 }
 function interaction(){if(!enabled)return;sample();lastInput=Date.now();}
 function roundData(a,outcome){
  const correct=a.mode==='memory'||a.mode==='connect'?a.matched?.length||0:a.mode==='order'?a.wordOrder?.solved?.length||0:a.step||0;
  const durationMs=Number.isFinite(a.durationMs)?a.durationMs:typeof elapsedGameMs==='function'?Math.round(elapsedGameMs(a)):0;
  return {roundId:round?.id||id(),island:a.index,game:a.mode,outcome,correct,mistakes:a.mistakes||0,turns:a.turns||0,recallHits:a.memoryRecallHits||0,recallErrors:a.memoryRecallErrors||0,hints:a.wordOrder?.hintsUsed||0,stars:a.stars||0,durationMs,coins:a.coins||0};
 }
 const api=window.XimenaMonitor={
  enabled,deviceId,standalone,testing,record,progress,interaction,checkpoint,
  ready:Promise.resolve(),
  setContext(value){context=value||{};},
  visitIsland(index,name){record('island_visit',{island:index,name});},
  startRound(a){if(!enabled)return;if(round)api.finishRound(round.a,'abandoned');round={id:id(),a};record('round_start',{roundId:round.id,island:a.index,game:a.mode});},
  finishRound(a,outcome='completed'){if(!enabled||!round||round.a!==a)return;record('round_end',roundData(a,outcome));round=null;},
  wordAttempt(a,word,outcome,details={}){
   if(!enabled||!round||round.a!==a||!word||typeof word.en!=='string'||typeof word.es!=='string')return;
   if(!['correct','incorrect','timeout','memory_correct','memory_miss','movement_miss','exploration'].includes(outcome))return;
   record('word_attempt',{roundId:round.id,island:a.index,game:a.mode,word:{en:word.en.slice(0,160),es:word.es.slice(0,160)},outcome,answer:typeof details.answer==='string'?details.answer.slice(0,160):null,reason:typeof details.reason==='string'?details.reason.slice(0,64):null});
  },
  coinChange(before,after,source,receiptId=null){if(before===after)return;record('coin_change',{before,after,delta:after-before,source,receiptId});},
  async allEvents(){await pending;return operation('events','readonly',s=>s.getAll());},
  async pendingEvents(){return (await api.allEvents()).filter(e=>!e.uploaded);},
  async acknowledge(ids){await pending;const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('events','readwrite'),s=tx.objectStore('events');for(const eventId of ids){const req=s.get(eventId);req.onsuccess=()=>{if(req.result)s.put({...req.result,uploaded:true});};}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});},
  async backups(){await api.ready;return operation('backups','readonly',s=>s.getAll());},
  async acknowledgeBackup(value){return operation('backups','readwrite',s=>s.put({...value,uploaded:true}));},
  presence(){return {...context,deviceId,sessionId:session?.id||'none',state:document.hidden?'hidden':isActive()?'active':'idle',at:Date.now(),lastInputAt:lastInput};},
  device(){return {id:deviceId,label:ipad?'iPad · app instalada':testing?'Pruebas locales':'Navegador',createdAt:Number(read(PREFIX+'createdAt')||Date.now()),standalone,...progress()};},
  setCloudStatus(value){cloudStatus=value;notify();},
  get status(){return cloudStatus;}
 };
 api.ready=(async()=>{
  if(!enabled)return;
  write(PREFIX+'createdAt',read(PREFIX+'createdAt')||String(Date.now()));
  await backup();
  const spool=[];try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX+'pending:'))spool.push(JSON.parse(localStorage.getItem(key)));}}catch{}
  for(const event of spool)await persist(event);
  const interrupted=read(PREFIX+'checkpoint');
  if(interrupted){try{const old=JSON.parse(interrupted);record('session_interrupted',{previousSessionId:old.id,lastConfirmedAt:old.at,reason:'unconfirmed_close'});}catch{}}
  start();
 })().catch(()=>{cloudStatus='storage-error';start();notify();});
 if(!enabled)return;
 document.addEventListener('pointerdown',event=>{interaction();held.add('pointer:'+event.pointerId);},true);
 document.addEventListener('pointerup',event=>{interaction();held.delete('pointer:'+event.pointerId);},true);
 document.addEventListener('pointercancel',event=>held.delete('pointer:'+event.pointerId),true);
 document.addEventListener('keydown',event=>{interaction();held.add('key:'+event.code);},true);
 document.addEventListener('keyup',event=>{interaction();held.delete('key:'+event.code);},true);
 document.addEventListener('input',interaction,true);
 window.addEventListener('blur',()=>held.clear());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)end('hidden');else start();});
 window.addEventListener('pagehide',event=>{if(!event.persisted&&round)api.finishRound(round.a,'interrupted');end('pagehide');});
 window.addEventListener('pageshow',()=>{api.ready.then(start);});
 setInterval(()=>sample(),5000);
 setInterval(()=>checkpoint(),cfg.heartbeatMs||60000);
})();
