import * as f from '/vendor/firebase-client.js';
import {summarize,summarizeWords,summarizeStars,presenceState,duration,GAME_NAMES,islandName,decode} from '/monitor-stats.mjs';
const cfg=window.XimenaMonitorConfig||{},$=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=at=>Number.isFinite(at)?new Intl.DateTimeFormat('es-MX',{timeZone:cfg.timeZone||'America/Hermosillo',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(at)):'—';
const number=value=>Number(value||0).toLocaleString('es-MX');
const text=(id,value)=>{$(id).textContent=value;};
const empty=(cols,message)=>`<tr><td class="empty" colspan="${cols}">${esc(message)}</td></tr>`;
const sourceName=source=>source?.startsWith('game:')?'Premio de partida':source?.startsWith('marine:')?'Encuentro marino':source?.startsWith('room:')?(source.endsWith(':decoy')?'Gasto en habitación':'Tesoro de habitación'):source==='inactivity'?'Visita de Mordisquitos':source==='redemption'?'Canje de monedas':'Gasto de monedas';
let auth,db,owner,selected='',enrollments={},authorized={},settings={},events=new Map(),current=null,presence=null,backup=null,sync=null,panelConnected=null,readError='',stops=[],deviceStops=[],cache;
const cacheReady=new Promise(resolve=>{
 const req=indexedDB.open('ximena-parent-cache-v1',1);
 req.onupgradeneeded=()=>req.result.createObjectStore('events',{keyPath:'cacheId'});
 req.onsuccess=()=>{cache=req.result;resolve();};req.onerror=()=>resolve();
});
async function cached(uid){await cacheReady;if(!cache)return [];return new Promise(resolve=>{const req=cache.transaction('events').objectStore('events').getAll();req.onsuccess=()=>resolve(req.result.filter(e=>e.deviceUid===uid).map(({cacheId,deviceUid,...e})=>e));req.onerror=()=>resolve([]);});}
function remember(uid,event){if(!cache)return;try{cache.transaction('events','readwrite').objectStore('events').put({...event,cacheId:`${uid}:${event.id}`,deviceUid:uid});}catch{}}
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
let renderTimer;
function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(render,100);}
function bars(rows){
 const max=rows.reduce((value,row)=>Math.max(value,row.total),1);
 return rows.map(row=>`<div class="chart-row"><div class="chart-label">${esc(row.label)}${row.detail?`<small>${esc(row.detail)}</small>`:''}</div><div class="chart-track" role="img" aria-label="${esc(row.description)}" title="${esc(row.description)}">${row.parts.filter(part=>part.value>0).map(part=>`<span class="chart-segment ${part.kind}" style="width:${part.value/max*100}%" aria-hidden="true">${part.value/max>=.12?number(part.value):''}</span>`).join('')}</div><span class="chart-count">${number(row.total)}</span></div>`).join('');
}
function renderPerformance(rounds){
 const select=$('performance-island'),previous=select.value;
 const islands=[...new Set(rounds.map(row=>row.island).filter(index=>Number.isInteger(index)&&index>=0))].sort((a,b)=>a-b);
 const options='<option value="">Todas las islas</option>'+islands.map(index=>`<option value="${index}">${esc(islandName(index))}</option>`).join('');
 if(select.innerHTML!==options){select.innerHTML=options;select.value=islands.includes(Number(previous))&&previous!==''?previous:'';}
 const filtered=select.value===''?rounds:rounds.filter(row=>row.island===Number(select.value));
 const chartRows=[];
 $('performance').innerHTML=Object.entries(GAME_NAMES).flatMap(([mode,name])=>{
  const byIsland=new Map(),gameRounds=filtered.filter(row=>row.game===mode);
  if(gameRounds.length){
   const completed=gameRounds.filter(row=>row.outcome==='completed').length,lost=gameRounds.filter(row=>row.outcome==='lost').length,interrupted=gameRounds.length-completed-lost;
   chartRows.push({label:name,total:gameRounds.length,description:`${name}: ${completed} completadas, ${lost} perdidas, ${interrupted} abandonadas o interrumpidas`,parts:[{kind:'completed',value:completed},{kind:'lost',value:lost},{kind:'interrupted',value:interrupted}]});
  }
  for(const row of gameRounds){if(!byIsland.has(row.island))byIsland.set(row.island,[]);byIsland.get(row.island).push(row);}
  return [...byIsland.entries()].sort(([a],[b])=>a-b).map(([island,rows])=>{
   const completed=rows.filter(r=>r.outcome==='completed');
   return `<tr><td>${esc(islandName(island))}</td><td>${esc(name)}</td><td>${completed.length}</td><td>${number(rows.reduce((n,r)=>n+(r.correct||0),0))}</td><td>${number(rows.reduce((n,r)=>n+(r.mistakes||0),0))}</td><td>${completed.length?duration(completed.reduce((best,r)=>Math.min(best,r.durationMs),Infinity)):'—'}</td></tr>`;
  });
 }).join('')||empty(6,'Cada isla y tipo de juego tendrán sus propios resultados.');
 $('performance-chart').innerHTML=chartRows.length?bars(chartRows):'<p class="chart-empty">Los resultados aparecerán cuando se reciban partidas.</p>';
}
function renderCoinsChart(coins){
 const rows=coins.slice(0,100).reverse().filter(row=>Number.isFinite(row.before)&&Number.isFinite(row.after));
 if(!rows.length){$('coins-chart').innerHTML='<p class="chart-empty">La evolución del saldo aparecerá con los primeros movimientos registrados.</p>';return;}
 const points=[{balance:rows[0].before,label:`Antes del primer movimiento mostrado: ${number(rows[0].before)} monedas`},...rows.map(row=>({balance:row.after,label:`${date(row.at)}: ${row.delta>=0?'+':'−'}${number(Math.abs(row.delta))} monedas; saldo ${number(row.after)}`}))];
 const maximum=points.reduce((max,point)=>Math.max(max,point.balance),1),step=10**Math.floor(Math.log10(maximum));
 const ceiling=Math.ceil(maximum/step)*step,width=640,height=160;
 const coords=points.map((point,index)=>({...point,x:index/(points.length-1)*width,y:height-point.balance/ceiling*height}));
 const path=coords.map((point,index)=>index?`H${point.x}V${point.y}`:`M${point.x},${point.y}`).join(' ');
 $('coins-chart').innerHTML=`<div class="chart-heading"><h3>Cómo cambia su saldo</h3><span>${number(rows.length)} movimientos más recientes</span></div><div class="balance-plot"><div class="balance-axis"><span>${number(ceiling)}</span><span>${number(ceiling/2)}</span><span>0</span></div><svg viewBox="-5 -6 650 172" preserveAspectRatio="none" role="img" aria-label="Evolución del saldo en orden de movimientos: de ${number(points[0].balance)} a ${number(points.at(-1).balance)} monedas"><title>Saldo después de cada movimiento registrado</title><path class="balance-grid" d="M0,0H640 M0,80H640 M0,160H640"/><path class="balance-area" d="${path}V160H0Z"/><path class="balance-line" d="${path}"/>${coords.map(point=>`<circle class="balance-point" cx="${point.x}" cy="${point.y}" r="3"><title>${esc(point.label)}</title></circle>`).join('')}</svg></div><div class="balance-dates"><span>Inicio · ${date(rows[0].at)}</span><span>Último · ${date(rows.at(-1).at)}</span></div><p class="footnote">Cada punto representa un movimiento, en orden cronológico. El saldo anterior al primer movimiento es el punto de partida.</p>`;
}
function renderWordPractice(){
 const result=summarizeWords([...events.values()],{game:$('word-game').value,search:$('word-search').value});
 text('word-summary',`${result.ranking.length} palabras con fallos · primeras 50`);
 const chartRows=result.ranking.filter(row=>row.incorrect>0).slice(0,8).map(row=>({label:row.en,detail:row.es,total:row.incorrect,description:`${row.en}: ${number(row.incorrect)} respuestas incorrectas`,parts:[{kind:'incorrect',value:row.incorrect}]}));
 $('word-chart').innerHTML=chartRows.length?bars(chartRows):'<p class="chart-empty">Todavía no hay respuestas incorrectas por palabra para esta selección.</p>';
 $('word-ranking').innerHTML=result.ranking.slice(0,50).map(row=>{
  const parts=[row.memoryErrors?`${number(row.memoryErrors)} memoria`:'',row.timeouts?`${number(row.timeouts)} tiempo`:'',row.movementErrors?`${number(row.movementErrors)} movimiento`:''].filter(Boolean).join(' · ');
  return `<tr><td class="word-label"><b>${esc(row.en)}</b><small>${esc(row.es)}</small></td><td class="negative">${number(row.incorrect)}</td><td>${number(row.correct)}</td><td title="${esc(parts)}">${number(row.otherFailures)}${parts?`<small class="word-subtext">${esc(parts)}</small>`:''}</td><td>${date(row.lastErrorAt)}</td></tr>`;
 }).join('')||empty(5,'Todavía no hay fallos por palabra para mostrar. Se registrarán cuando el iPad reciba esta actualización.');
 const labels={incorrect:'Respuesta incorrecta',memory_miss:'Memoria',timeout:'Tiempo agotado',movement_miss:'Movimiento / caída'};
 $('word-attempts').innerHTML=result.attempts.slice(0,50).map(row=>`<tr><td>${date(row.at)}</td><td>${esc(row.word.en)}</td><td>${esc(GAME_NAMES[row.game])}</td><td>${esc(row.reason==='wrong_letter'?'Letra incorrecta':labels[row.outcome])}</td><td>${esc(row.answer||'—')}</td></tr>`).join('')||empty(5,'No hay errores registrados para esta selección.');
}
function render(){
 const s=summarize([...events.values()],{timeZone:cfg.timeZone});
 const enrollment=enrollments[selected],waiting=Boolean(selected&&!current&&!presence&&!events.size);
 const status=presenceState(presence),labels={active:'Jugando · activa',idle:'App abierta · inactiva',closed:'App en segundo plano o cerrada',unknown:'Sin conexión confirmada'};
 $('presence').className=`status-pill ${status}`;text('presence',labels[status]);
 const game=GAME_NAMES[presence?.game];
 text('current-game',status==='active'||status==='idle'?(game?`${game} · Isla ${Number(presence.island)+1}`:'Explorando las islas'):'Esperando su próxima aventura');
 text('presence-detail',presence?`Última señal: ${date(presence.serverAt)}. La falta de señal no confirma que haya terminado de jugar.`:enrollment?`iPad detectado: ${date(enrollment.seenAt)}. Aún no hay una señal de juego recibida.`:'El iPad aparecerá después de abrir la versión actualizada.');
 text('updated',readError||(panelConnected===false?'Tu panel está sin conexión. Los datos mostrados pueden estar desactualizados.':current?`Progreso recibido: ${date(current.serverAt)} · actualización cada minuto`:selected?'iPad autorizado · esperando el primer envío.':'Esperando la primera conexión del iPad.'));
 const stages={presence:'señal de juego',progress:'progreso',backup:'respaldo',events:'historial'};
 const failures=Object.entries(sync?.errors||{}).map(([stage,code])=>`${stages[stage]||stage} (${code})`);
 text('sync-detail',sync?.state==='partial'?`Último intento: ${date(sync.serverAt)}. Pendiente de enviar: ${failures.join(', ')||'parte de los registros'}. Se reintentará con el juego abierto; los pendientes se conservan en el iPad.`:waiting?'La autorización ya está lista. El juego necesita estar abierto y con internet para enviar su progreso e historial. Si está cerrado, se enviarán al volver a abrirlo.':sync?`Última sincronización completa: ${date(sync.serverAt)}. Versión del juego: ${sync.appVersion}.`:selected?'Este dispositivo todavía no ha enviado un diagnóstico de sincronización.':'Autoriza el iPad cuando aparezca su solicitud.');
 text('coin-balance',current?number(current.coins):'—');
 for(const [key,value] of [['today',s.today],['week',s.week],['all',s.totals]]){text(`${key}-total`,events.size?duration(value.totalMs):'—');text(`${key}-breakdown`,events.size?`${duration(value.activeMs)} activo · ${duration(value.idleMs)} inactivo`:'Esperando registros del iPad');}
 const stars=summarizeStars(current?.stars||{}),completed=new Set([...Object.keys(current?.stars||{}),...Object.keys(current?.bestTimes||{})]);
 text('total-stars',current?`${number(stars.normal)} ★`:'—');text('red-stars',current?`${number(stars.red)} ★`:'—');text('progress-detail',current?`${completed.size} juegos con progreso guardado`:'Esperando progreso del iPad');
 const max=Math.max(60000,...s.chart.map(d=>d.totalMs));
 $('daily-chart').innerHTML=events.size?s.chart.map(d=>{const height=d.totalMs/max*125,active=d.totalMs?d.activeMs/d.totalMs*100:0;return `<div class="chart-day" title="${esc(d.key)}: ${duration(d.activeMs)} activo; ${duration(d.idleMs)} inactivo; ${d.completed} partidas completadas"><span class="chart-value">${duration(d.totalMs)}</span><div class="bar-wrap"><div class="bar" style="height:${height}px"><i class="bar-active" style="height:${active}%"></i><i class="bar-idle" style="height:${100-active}%"></i></div></div><small>${esc(d.key.slice(5).split('-').reverse().join('/'))}</small><small>${d.completed} partidas</small></div>`;}).join(''):'<p class="footnote">La gráfica aparecerá cuando se reciban los primeros registros del iPad.</p>';
 $('achievements').innerHTML=[['Partidas completadas',s.totals.completed],['Partidas perdidas',s.totals.lost],['Partidas abandonadas / interrumpidas',s.totals.abandoned],['Islas visitadas',s.visited]].map(([key,val])=>`<div><dt>${esc(key)}</dt><dd>${events.size?number(val):'—'}</dd></div>`).join('');
 $('sessions').innerHTML=s.sessions.slice(0,30).map(row=>`<tr><td>${date(row.start)}</td><td>${row.end?date(row.end):`Última actividad: ${date(row.confirmedUntil)}${row.interrupted?' · cierre sin confirmar':''}`}</td><td>${duration(row.totalMs)}</td><td>${duration(row.activeMs)}</td><td>${duration(row.idleMs)}</td></tr>`).join('')||empty(5,'Las nuevas sesiones aparecerán aquí.');
 const outcomes={completed:'Completada',lost:'Perdida',abandoned:'Abandonada',interrupted:'Interrumpida'};
 $('rounds').innerHTML=s.rounds.slice(0,50).map(row=>`<tr><td>${date(row.at)}</td><td>${esc(islandName(row.island))} · ${esc(GAME_NAMES[row.game]||row.game)}</td><td>${esc(outcomes[row.outcome]||row.outcome)}</td><td>${number(row.correct)}</td><td>${number(row.mistakes)}</td><td>${duration(row.durationMs)}</td></tr>`).join('')||empty(6,'Las partidas se registrarán desde esta actualización.');
 renderPerformance(s.rounds);
 renderCoinsChart(s.coins);
 text('coin-summary',events.size?`+${number(s.totals.earned)} ganadas · −${number(s.totals.spent)} salidas registradas`:'Esperando movimientos del iPad');
 $('coins').innerHTML=s.coins.slice(0,100).map(row=>`<tr><td>${date(row.at)}</td><td>${esc(sourceName(row.source))}</td><td class="${row.delta>0?'positive':'negative'}">${row.delta>0?'+':'−'}${number(Math.abs(row.delta))}</td><td>${number(row.after)}</td></tr>`).join('')||empty(4,'El saldo anterior es el punto de partida; los nuevos movimientos aparecerán aquí.');
 $('download-backup').disabled=!backup;
 text('backup-status',backup?`Copia inicial recibida · ${date(backup.at)}. Incluye las claves originales del progreso guardado.`:selected?'Respaldo aún no recibido. Se intentará enviar cuando el juego esté abierto y tenga internet.':'El respaldo inicial se recibirá cuando el iPad se conecte y autorices el dispositivo.');
 renderWordPractice();
}
async function selectDevice(uid){
 deviceStops.forEach(stop=>stop());deviceStops=[];selected=uid;events=new Map();current=presence=backup=sync=null;readError='';render();
 $('export').disabled=true;
 if(!uid||!db)return;
 const rows=await cached(uid);if(selected!==uid)return;
 rows.forEach(event=>events.set(event.id,event));render();
 const last=rows.reduce((latest,event)=>Math.max(latest,event.receivedAt||0),0);
 const path=`devices/${uid}`;
 const receive=snapshot=>{if(selected!==uid)return;const event={...snapshot.val(),id:snapshot.key};events.set(event.id,event);remember(uid,event);schedule();};
 const stream=f.query(f.ref(db,`${path}/events`),f.orderByChild('receivedAt'),f.startAt(Math.max(0,last-60000)));
 deviceStops.push(f.onChildAdded(stream,receive),f.onChildChanged(stream,receive));
 deviceStops.push(f.onValue(stream,()=>{$('export').disabled=false;},()=>{readError='No se pudo descargar todo el historial. Revisa tu conexión.';schedule();},{onlyOnce:true}));
 for(const [name,assign] of [['current',v=>{current=v;}],['presence',v=>{presence=v;}],['backups/initial',v=>{backup=v;}],['sync',v=>{sync=v;}]])deviceStops.push(f.onValue(f.ref(db,`${path}/${name}`),snapshot=>{if(selected!==uid)return;assign(snapshot.val());schedule();},()=>{readError='No se pudo leer el dispositivo. Revisa la conexión o vuelve a entrar.';schedule();}));
}
function listDevices(){
 const allowed=Object.keys(authorized).filter(uid=>authorized[uid]===true&&enrollments[uid]);
 $('device-select').innerHTML=allowed.map(uid=>`<option value="${esc(uid)}">${esc(enrollments[uid].label)} · ${esc(uid.slice(0,6))}</option>`).join('')||'<option value="">Sin dispositivo autorizado</option>';
 const next=allowed.includes(settings.selectedDevice)?settings.selectedDevice:allowed.includes(selected)?selected:allowed[0]||'';
 $('device-select').value=next;if(next!==selected)selectDevice(next);
 const pending=Object.entries(enrollments).filter(([uid])=>!authorized[uid]);
 $('pending-devices').hidden=!pending.length;
 $('pending-devices').innerHTML=pending.length?`<h2>Un dispositivo quiere compartir su aventura</h2><p>Reconoce el iPad por su saldo y estrellas. Al autorizarlo se enviarán los registros pendientes y el respaldo.</p>${pending.map(([uid,d])=>`<div class="candidate"><span><b>${esc(d.label)}</b> · ${number(d.coins)} monedas · ${number(d.stars)} estrellas<br>Detectado: ${date(d.seenAt)}</span><button class="primary" data-approve="${esc(uid)}">Es el iPad de Ximena</button></div>`).join('')}`:'';
 schedule();
}
function fail(error){text('login-message',error.code==='PERMISSION_DENIED'?'Esta cuenta no tiene permiso para consultar el historial.':error.code==='auth/popup-closed-by-user'?'Se cerró el acceso. Puedes intentarlo de nuevo.':'No se pudo conectar. Revisa tu conexión y la configuración de Firebase.');$('google-login').disabled=false;}
if(!cfg.firebase){$('google-login').disabled=true;text('login-message','El panel está preparado. Falta conectar la configuración del proyecto InglesXime.');}
else{
 const app=f.initializeApp(cfg.firebase,'ximena-monitor-parent');auth=f.getAuth(app);db=f.getDatabase(app);
 f.onValue(f.ref(db,'.info/connected'),snapshot=>{panelConnected=snapshot.val()===true;schedule();});
 text('login-message','Acceso reservado a tu cuenta de Google.');
 $('google-login').addEventListener('click',()=>{const provider=new f.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});f.signInWithPopup(auth,provider).catch(fail);});
 $('logout').addEventListener('click',()=>f.signOut(auth));
 f.onAuthStateChanged(auth,user=>{
  stops.forEach(stop=>stop());deviceStops.forEach(stop=>stop());stops=[];deviceStops=[];owner=user;events=new Map();selected='';current=presence=backup=sync=null;enrollments={};authorized={};settings={};readError='';
  $('dashboard').hidden=true;$('login').hidden=false;$('logout').hidden=!user;text('account-name',user?.email||'');
  if(!user)return;
  stops.push(f.onValue(f.ref(db,'enrollments'),snapshot=>{
   enrollments=snapshot.val()||{};$('dashboard').hidden=false;$('login').hidden=true;listDevices();render();
  },error=>{$('dashboard').hidden=true;$('login').hidden=false;fail(error);}));
  stops.push(f.onValue(f.ref(db,'authorizedDevices'),snapshot=>{authorized=snapshot.val()||{};listDevices();}));
  stops.push(f.onValue(f.ref(db,'settings'),snapshot=>{settings=snapshot.val()||{};listDevices();}));
 });
}
$('pending-devices').addEventListener('click',async event=>{
 const button=event.target.closest('[data-approve]');if(!button||!owner)return;
 button.disabled=true;
 try{await f.update(f.ref(db),{[`authorizedDevices/${button.dataset.approve}`]:true,'settings/selectedDevice':button.dataset.approve});}catch{button.disabled=false;text('updated','No se pudo autorizar el iPad. Inténtalo otra vez.');}
});
$('device-select').addEventListener('change',()=>f.set(f.ref(db,'settings/selectedDevice'),$('device-select').value).catch(()=>text('updated','No se pudo guardar la selección.')));
$('export').addEventListener('click',()=>download(`ximena-historial-${new Date().toISOString().slice(0,10)}.json`,{schema:1,exportedAt:Date.now(),timeZone:cfg.timeZone,device:selected,current,presence,sync,enrollment:enrollments[selected]||null,events:[...events.values()].map(decode)}));
$('download-backup').addEventListener('click',()=>{if(backup)download('ximena-respaldo-inicial.json',{schema:1,device:selected,...backup});});
$('word-game').insertAdjacentHTML('beforeend',Object.entries(GAME_NAMES).map(([key,name])=>`<option value="${key}">${esc(name)}</option>`).join(''));
$('word-game').addEventListener('change',renderWordPractice);
$('word-search').addEventListener('input',renderWordPractice);
$('performance-island').addEventListener('change',render);
setInterval(()=>{if(!$('dashboard').hidden)render();},60000);
