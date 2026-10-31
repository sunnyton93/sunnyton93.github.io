export const GAME_NAMES={find:'Encuentra',connect:'Conecta',memory:'Memoria',archery:'Atrapa',platforms:'Salta',pirate:'Banderas',blaster:'Escribe',order:'Ordena'};
// Same stable order as oceanIslands, including the three Spelling Bee islands.
export const ISLAND_NAMES=['Playa Palmita','Laguna Tortuga','Faro Lucero','Jardín de Coral','Cascada Esmeralda','Volcán Dormilón','Puerto Caracol','Bahía de las Perlas','Bosque Mariposa','La Isla del Tesoro','Glaciar Brillante','Castillo del Sol','Isla Messi','Isla Canasta','Isla Melodía','Isla Ajedrez','Isla de los Perros','Piratas del Caribe','Isla Erling Haaland','Isla de la Escuela','Isla Mario Kart','Chispa Traviesa','Libro Mágico','Reloj Volador'];
export function islandName(index){return Number.isInteger(index)&&index>=0?ISLAND_NAMES[index]||`Isla ${index+1}`:'Isla sin identificar';}
export const SPELLING_BEE_ISLAND_INDEXES=[21,22,23];
export function summarizeStars(progress={}){
 const totals={normal:0,red:0};
 for(let index=0;index<ISLAND_NAMES.length;index++)for(const mode of Object.keys(GAME_NAMES)){
  if(mode==='memory')continue;
  const stars=progress[`${index}-${mode}`];
  if(Number.isInteger(stars)&&stars>=0&&stars<=3)totals[SPELLING_BEE_ISLAND_INDEXES.includes(index)?'red':'normal']+=stars;
 }
 return totals;
}
export function dayKey(at,timeZone='America/Hermosillo'){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
}
export function decode(event){try{return {...event,data:typeof event.payload==='string'?JSON.parse(event.payload):event.data||{}};}catch{return {...event,data:{}};}}
export function summarizeWords(rawEvents,{game='',search=''}={}){
 const normalize=value=>value.normalize('NFKC').replace(/[’‘]/g,"'").trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
 const needle=normalize(search),words=new Map(),attempts=[];
 const valid=new Set(['correct','incorrect','timeout','memory_correct','memory_miss','movement_miss','exploration']);
 const seen=new Set();
 for(const raw of rawEvents){
  if(raw.kind!=='word_attempt'||seen.has(raw.id))continue;seen.add(raw.id);
  const event=decode(raw),d=event.data,word=d?.word;
  if(!word||typeof word.en!=='string'||typeof word.es!=='string'||word.en.length>160||word.es.length>160||!normalize(word.en)||!normalize(word.es)||!valid.has(d.outcome)||!Object.prototype.hasOwnProperty.call(GAME_NAMES,d.game)||!Number.isFinite(event.at))continue;
  if(game&&d.game!==game)continue;
  if(needle&&!normalize(word.en+' '+word.es).includes(needle))continue;
  const key=normalize(word.en)+'\u0000'+normalize(word.es);
  if(!words.has(key))words.set(key,{key,en:word.en.trim(),es:word.es.trim(),correct:0,incorrect:0,memoryErrors:0,timeouts:0,movementErrors:0,exploration:0,otherFailures:0,lastErrorAt:null,lastAttemptAt:0,games:new Set()});
  const row=words.get(key);row.games.add(d.game);row.lastAttemptAt=Math.max(row.lastAttemptAt,event.at);
  if(d.outcome==='correct'||d.outcome==='memory_correct')row.correct++;
  else if(d.outcome==='incorrect')row.incorrect++;
  else if(d.outcome==='memory_miss'){row.memoryErrors++;row.otherFailures++;}
  else if(d.outcome==='timeout'){row.timeouts++;row.otherFailures++;}
  else if(d.outcome==='movement_miss'){row.movementErrors++;row.otherFailures++;}
  else row.exploration++;
  if(['incorrect','memory_miss','timeout','movement_miss'].includes(d.outcome)){
   row.lastErrorAt=Math.max(row.lastErrorAt||0,event.at);
   attempts.push({id:event.id,at:event.at,...d,answer:typeof d.answer==='string'?d.answer.slice(0,160):null});
  }
 }
 const ranking=[...words.values()].filter(w=>w.incorrect||w.otherFailures).sort((a,b)=>b.incorrect-a.incorrect||b.otherFailures-a.otherFailures||b.lastErrorAt-a.lastErrorAt||a.en.localeCompare(b.en));
 return {ranking,attempts:attempts.sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)),totalWords:words.size};
}
export function summarize(rawEvents,{timeZone='America/Hermosillo',now=Date.now(),days=7}={}){
 const events=[...new Map(rawEvents.map(e=>[e.id,e])).values()].map(decode).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 const totals={totalMs:0,activeMs:0,idleMs:0,earned:0,spent:0,completed:0,lost:0,abandoned:0,correct:0,mistakes:0};
 const daily={},sessions=new Map(),visits=new Set(),rounds=[],coins=[],edges=[];
 const bucket=key=>daily[key]||=( {totalMs:0,activeMs:0,idleMs:0,completed:0,correct:0,mistakes:0} );
 for(const event of events){
  const d=event.data;
  if(event.kind==='session_start')sessions.set(event.sessionId,{id:event.sessionId,start:event.at,end:null,confirmedUntil:event.at,totalMs:0,activeMs:0,idleMs:0});
  if(event.kind==='activity'){
   const session=sessions.get(event.sessionId);
   for(const part of d.intervals||[]){
    if(!Number.isFinite(part.from)||!Number.isFinite(part.to)||part.to<=part.from)continue;
    const end=Math.min(part.to,part.from+15000),activeEnd=Math.min(end,part.from+Math.max(0,part.activeMs||0));
    edges.push({at:part.from,visible:1,active:0},{at:end,visible:-1,active:0});
    if(activeEnd>part.from)edges.push({at:part.from,visible:0,active:1},{at:activeEnd,visible:0,active:-1});
    for(let from=part.from;from<end;){
     const to=Math.min(end,(Math.floor(from/60000)+1)*60000),duration=to-from,active=Math.max(0,Math.min(to,activeEnd)-from);
     if(session){session.totalMs+=duration;session.activeMs+=active;session.idleMs+=duration-active;}
     from=to;
    }
    if(session)session.confirmedUntil=Math.max(session.confirmedUntil,end);
   }
  }
  if(event.kind==='session_end'&&sessions.has(event.sessionId)){Object.assign(sessions.get(event.sessionId),{end:event.at,reason:d.reason});}
  if(event.kind==='session_interrupted'&&sessions.has(d.previousSessionId)){Object.assign(sessions.get(d.previousSessionId),{interrupted:true,confirmedUntil:d.lastConfirmedAt});}
  if(event.kind==='island_visit')visits.add(d.island);
  if(event.kind==='round_end'){
   rounds.push({...d,at:event.at,id:event.id});
   if(d.outcome==='completed'){totals.completed++;const b=bucket(dayKey(event.at,timeZone));b.completed++;b.correct+=d.correct||0;b.mistakes+=d.mistakes||0;}
   else if(d.outcome==='lost')totals.lost++;else totals.abandoned++;
   totals.correct+=d.correct||0;totals.mistakes+=d.mistakes||0;
  }
  if(event.kind==='coin_change'){
   coins.push({...d,at:event.at,id:event.id});
   if(d.delta>0)totals.earned+=d.delta;else totals.spent-=d.delta||0;
  }
 }
 // Count a child's time once even if two windows are visible concurrently.
 edges.sort((a,b)=>a.at-b.at);
 let visible=0,active=0,previous=edges[0]?.at||0;
 for(let index=0;index<edges.length;){
  const at=edges[index].at;
  if(visible>0)for(let from=previous;from<at;){
   const to=Math.min(at,(Math.floor(from/60000)+1)*60000),elapsed=to-from,b=bucket(dayKey(from,timeZone));
   for(const target of [totals,b]){target.totalMs+=elapsed;target.activeMs+=active>0?elapsed:0;target.idleMs+=active>0?0:elapsed;}
   from=to;
  }
  while(index<edges.length&&edges[index].at===at){visible+=edges[index].visible;active+=edges[index].active;index++;}
  previous=at;
 }
 const chart=Array.from({length:days},(_,i)=>{const at=now-(days-1-i)*86400000,key=dayKey(at,timeZone);return {key,...(daily[key]||bucket(key))};});
 const today=daily[dayKey(now,timeZone)]||bucket(dayKey(now,timeZone));
 const week=chart.reduce((a,d)=>({totalMs:a.totalMs+d.totalMs,activeMs:a.activeMs+d.activeMs,idleMs:a.idleMs+d.idleMs}),{totalMs:0,activeMs:0,idleMs:0});
 return {events,totals,daily,today,week,chart,sessions:[...sessions.values()].reverse(),rounds:rounds.reverse(),coins:coins.reverse(),visited:visits.size};
}
export function presenceState(presence,now=Date.now(),idleMs=120000){
 if(!presence)return 'unknown';
 if(presence.state==='hidden')return 'closed';
 if(!Number.isFinite(presence.serverAt)||now-presence.serverAt>150000)return 'unknown';
 if(presence.state==='offline')return 'unknown';
 return presence.state==='active'&&now-presence.lastInputAt<idleMs?'active':'idle';
}
export function duration(ms){const value=Math.max(0,ms||0),minutes=Math.floor(value/60000);return minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:minutes?`${minutes} min`:value?`${Math.floor(value/1000)} s`:'0 min';}
