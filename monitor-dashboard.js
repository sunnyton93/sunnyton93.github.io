import * as f from '/vendor/firebase-client.js';
import {summarize,presenceState,duration,GAME_NAMES,decode} from '/monitor-stats.mjs';
const cfg=window.XimenaMonitorConfig||{},$=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=at=>Number.isFinite(at)?new Intl.DateTimeFormat('es-MX',{timeZone:cfg.timeZone||'America/Hermosillo',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(at)):'—';
const number=value=>Number(value||0).toLocaleString('es-MX');
const text=(id,value)=>{$(id).textContent=value;};
const empty=(cols,message)=>`<tr><td class="empty" colspan="${cols}">${esc(message)}</td></tr>`;
const sourceName=source=>source?.startsWith('game:')?'Premio de partida':source?.startsWith('marine:')?'Encuentro marino':source?.startsWith('room:')?(source.endsWith(':decoy')?'Gasto en habitación':'Tesoro de habitación'):source==='inactivity'?'Visita de Mordisquitos':source==='redemption'?'Canje de monedas':'Gasto de monedas';
let auth,db,owner,selected='',enrollments={},authorized={},settings={},events=new Map(),current=null,presence=null,backup=null,stops=[],deviceStops=[],cache;
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
function render(){
 const s=summarize([...events.values()],{timeZone:cfg.timeZone});
 const status=presenceState(presence),labels={active:'Jugando · activa',idle:'App abierta · inactiva',closed:'App en segundo plano o cerrada',unknown:'Sin conexión confirmada'};
 $('presence').className=`status-pill ${status}`;text('presence',labels[status]);
 const game=GAME_NAMES[presence?.game];
 text('current-game',status==='active'||status==='idle'?(game?`${game} · Isla ${Number(presence.island)+1}`:'Explorando las islas'):'Esperando su próxima aventura');
 text('presence-detail',presence?`Última señal: ${date(presence.serverAt)}. La falta de señal no confirma que haya terminado de jugar.`:'El iPad aparecerá después de abrir la versión actualizada.');
 text('updated',current?`Progreso recibido: ${date(current.serverAt)} · actualización cada minuto`:'Esperando la primera conexión del iPad.');
 text('coin-balance',current?number(current.coins):'—');
 for(const [key,value] of [['today',s.today],['week',s.week],['all',s.totals]]){text(`${key}-total`,duration(value.totalMs));text(`${key}-breakdown`,`${duration(value.activeMs)} activo · ${duration(value.idleMs)} inactivo`);}
 const stars=Object.values(current?.stars||{}).reduce((sum,v)=>sum+v,0),completed=new Set([...Object.keys(current?.stars||{}),...Object.keys(current?.bestTimes||{})]);
 text('total-stars',current?`${number(stars)} ★`:'—');text('progress-detail',`${completed.size} juegos con progreso guardado`);
 const max=Math.max(60000,...s.chart.map(d=>d.totalMs));
 $('daily-chart').innerHTML=s.chart.map(d=>{const height=d.totalMs/max*125,active=d.totalMs?d.activeMs/d.totalMs*100:0;return `<div class="chart-day" title="${esc(d.key)}: ${duration(d.activeMs)} activo; ${duration(d.idleMs)} inactivo; ${d.completed} partidas completadas"><span class="chart-value">${duration(d.totalMs)}</span><div class="bar-wrap"><div class="bar" style="height:${height}px"><i class="bar-active" style="height:${active}%"></i><i class="bar-idle" style="height:${100-active}%"></i></div></div><small>${esc(d.key.slice(5).split('-').reverse().join('/'))}</small><small>${d.completed} partidas</small></div>`;}).join('');
 $('achievements').innerHTML=[['Partidas completadas',s.totals.completed],['Partidas perdidas',s.totals.lost],['Partidas abandonadas / interrumpidas',s.totals.abandoned],['Islas visitadas',s.visited]].map(([key,val])=>`<div><dt>${esc(key)}</dt><dd>${number(val)}</dd></div>`).join('');
 $('sessions').innerHTML=s.sessions.slice(0,30).map(row=>`<tr><td>${date(row.start)}</td><td>${row.end?date(row.end):`Última actividad: ${date(row.confirmedUntil)}${row.interrupted?' · cierre sin confirmar':''}`}</td><td>${duration(row.totalMs)}</td><td>${duration(row.activeMs)}</td><td>${duration(row.idleMs)}</td></tr>`).join('')||empty(5,'Las nuevas sesiones aparecerán aquí.');
 const outcomes={completed:'Completada',lost:'Perdida',abandoned:'Abandonada',interrupted:'Interrumpida'};
 $('rounds').innerHTML=s.rounds.slice(0,50).map(row=>`<tr><td>${date(row.at)}</td><td>Isla ${number(Number(row.island)+1)} · ${esc(GAME_NAMES[row.game]||row.game)}</td><td>${esc(outcomes[row.outcome]||row.outcome)}</td><td>${number(row.correct)}</td><td>${number(row.mistakes)}</td><td>${duration(row.durationMs)}</td></tr>`).join('')||empty(6,'Las partidas se registrarán desde esta actualización.');
 $('performance').innerHTML=Object.entries(GAME_NAMES).flatMap(([mode,name])=>{
  const rows=s.rounds.filter(r=>r.game===mode),completed=rows.filter(r=>r.outcome==='completed');if(!rows.length)return [];
  return [`<tr><td>${esc(name)}</td><td>${completed.length}</td><td>${number(rows.reduce((n,r)=>n+(r.correct||0),0))}</td><td>${number(rows.reduce((n,r)=>n+(r.mistakes||0),0))}</td><td>${completed.length?duration(Math.min(...completed.map(r=>r.durationMs))):'—'}</td></tr>`];
 }).join('')||empty(5,'Cada tipo de juego tendrá sus propios resultados.');
 text('coin-summary',`+${number(s.totals.earned)} ganadas · −${number(s.totals.spent)} salidas registradas`);
 $('coins').innerHTML=s.coins.slice(0,100).map(row=>`<tr><td>${date(row.at)}</td><td>${esc(sourceName(row.source))}</td><td class="${row.delta>0?'positive':'negative'}">${row.delta>0?'+':'−'}${number(Math.abs(row.delta))}</td><td>${number(row.after)}</td></tr>`).join('')||empty(4,'El saldo anterior es el punto de partida; los nuevos movimientos aparecerán aquí.');
 $('download-backup').disabled=!backup;
 text('backup-status',backup?`Copia inicial recibida · ${date(backup.at)}. Incluye las claves originales del progreso guardado.`:'El respaldo inicial se recibirá cuando el iPad se conecte y autorices el dispositivo.');
}
async function selectDevice(uid){
 deviceStops.forEach(stop=>stop());deviceStops=[];selected=uid;events=new Map();current=presence=backup=null;render();
 $('export').disabled=true;
 if(!uid||!db)return;
 const rows=await cached(uid);if(selected!==uid)return;
 rows.forEach(event=>events.set(event.id,event));render();
 const last=Math.max(0,...rows.map(e=>e.receivedAt||0));
 const path=`devices/${uid}`;
 const receive=snapshot=>{if(selected!==uid)return;const event={...snapshot.val(),id:snapshot.key};events.set(event.id,event);remember(uid,event);schedule();};
 const stream=f.query(f.ref(db,`${path}/events`),f.orderByChild('receivedAt'),f.startAt(Math.max(0,last-60000)));
 deviceStops.push(f.onChildAdded(stream,receive),f.onChildChanged(stream,receive));
 deviceStops.push(f.onValue(stream,()=>{$('export').disabled=false;},()=>text('updated','No se pudo descargar todo el historial. Revisa tu conexión.'),{onlyOnce:true}));
 for(const [name,assign] of [['current',v=>{current=v;}],['presence',v=>{presence=v;}],['backups/initial',v=>{backup=v;}]])deviceStops.push(f.onValue(f.ref(db,`${path}/${name}`),snapshot=>{assign(snapshot.val());schedule();},()=>text('updated','No se pudo leer el dispositivo. Revisa la conexión o vuelve a entrar.')));
}
function listDevices(){
 const allowed=Object.keys(authorized).filter(uid=>authorized[uid]===true&&enrollments[uid]);
 $('device-select').innerHTML=allowed.map(uid=>`<option value="${esc(uid)}">${esc(enrollments[uid].label)} · ${esc(uid.slice(0,6))}</option>`).join('')||'<option value="">Sin dispositivo autorizado</option>';
 const next=allowed.includes(settings.selectedDevice)?settings.selectedDevice:allowed.includes(selected)?selected:allowed[0]||'';
 $('device-select').value=next;if(next!==selected)selectDevice(next);
 const pending=Object.entries(enrollments).filter(([uid])=>!authorized[uid]);
 $('pending-devices').hidden=!pending.length;
 $('pending-devices').innerHTML=pending.length?`<h2>Un dispositivo quiere compartir su aventura</h2><p>Reconoce el iPad por su saldo y estrellas. Al autorizarlo se enviarán los registros pendientes y el respaldo.</p>${pending.map(([uid,d])=>`<div class="candidate"><span><b>${esc(d.label)}</b> · ${number(d.coins)} monedas · ${number(d.stars)} estrellas<br>Detectado: ${date(d.seenAt)}</span><button class="primary" data-approve="${esc(uid)}">Es el iPad de Ximena</button></div>`).join('')}`:'';
}
function fail(error){text('login-message',error.code==='PERMISSION_DENIED'?'Esta cuenta no tiene permiso para consultar el historial.':error.code==='auth/popup-closed-by-user'?'Se cerró el acceso. Puedes intentarlo de nuevo.':'No se pudo conectar. Revisa tu conexión y la configuración de Firebase.');$('google-login').disabled=false;}
if(!cfg.firebase){$('google-login').disabled=true;text('login-message','El panel está preparado. Falta conectar la configuración del proyecto InglesXime.');}
else{
 const app=f.initializeApp(cfg.firebase,'ximena-monitor-parent');auth=f.getAuth(app);db=f.getDatabase(app);
 text('login-message','Acceso reservado a tu cuenta de Google.');
 $('google-login').addEventListener('click',()=>{const provider=new f.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});f.signInWithPopup(auth,provider).catch(fail);});
 $('logout').addEventListener('click',()=>f.signOut(auth));
 f.onAuthStateChanged(auth,user=>{
  stops.forEach(stop=>stop());deviceStops.forEach(stop=>stop());stops=[];deviceStops=[];owner=user;events=new Map();selected='';current=presence=backup=null;
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
$('export').addEventListener('click',()=>download(`ximena-historial-${new Date().toISOString().slice(0,10)}.json`,{schema:1,exportedAt:Date.now(),timeZone:cfg.timeZone,device:selected,current,events:[...events.values()].map(decode)}));
$('download-backup').addEventListener('click',()=>{if(backup)download('ximena-respaldo-inicial.json',{schema:1,device:selected,...backup});});
setInterval(()=>{if(!$('dashboard').hidden)render();},60000);
