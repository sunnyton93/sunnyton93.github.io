/* Firebase is optional: a connection failure must never prevent playing. */
const monitor=window.XimenaMonitor,config=window.XimenaMonitorConfig;
if(monitor?.enabled&&config?.firebase){
 let starting=false,started=false;
 const connect=async()=>{
  if(starting||started)return;
  starting=true;
  try{
  await monitor.ready;
  const f=await import('/vendor/firebase-client.js');
  const app=f.initializeApp(config.firebase,'ximena-monitor-device'),auth=f.getAuth(app),db=f.getDatabase(app);
  await auth.authStateReady();
  const user=auth.currentUser||(await f.signInAnonymously(auth)).user;
  const uid=user.uid,root=`devices/${uid}`;
  let approved=false,connected=false,flushing=false;
  const progress=monitor.progress();
  await f.set(f.ref(db,`enrollments/${uid}`),{deviceId:monitor.deviceId,label:monitor.device().label,standalone:monitor.standalone,createdAt:monitor.device().createdAt,coins:progress.coins,stars:Object.values(progress.stars).reduce((sum,v)=>sum+v,0),seenAt:f.serverTimestamp()});
  monitor.setCloudStatus('awaiting-approval');
  async function flush(){
   if(!approved||!connected||flushing||!navigator.onLine)return;
   flushing=true;
   try{
    for(const backup of await monitor.backups())if(!backup.uploaded){
     await f.set(f.ref(db,`${root}/backups/${backup.id}`),{at:backup.at,appVersion:backup.appVersion,payload:JSON.stringify(backup.values)});
     await monitor.acknowledgeBackup(backup);
    }
    const events=await monitor.pendingEvents();
    for(let offset=0;offset<events.length;offset+=100){
     const batch=events.slice(offset,offset+100),changes={};
     for(const event of batch){const {uploaded,...data}=event;changes[`events/${event.id}`]={...data,receivedAt:f.serverTimestamp()};}
     await f.update(f.ref(db,root),changes);
     await monitor.acknowledge(batch.map(e=>e.id));
    }
    await f.set(f.ref(db,`${root}/current`),{...monitor.progress(),at:Date.now(),serverAt:f.serverTimestamp()});
    await f.set(f.ref(db,`${root}/presence`),{...monitor.presence(),serverAt:f.serverTimestamp()});
    monitor.setCloudStatus('synced');
   }catch(error){monitor.setCloudStatus(error.code==='PERMISSION_DENIED'?'access-denied':'pending');}
   finally{flushing=false;}
  }
  f.onValue(f.ref(db,`authorizedDevices/${uid}`),snapshot=>{
   approved=snapshot.val()===true;
   monitor.setCloudStatus(approved?'pending':'awaiting-approval');
   if(approved&&connected){
    f.onDisconnect(f.ref(db,`${root}/presence`)).set({...monitor.presence(),state:'offline',serverAt:f.serverTimestamp()}).then(flush).catch(()=>monitor.setCloudStatus('pending'));
   }
  },()=>monitor.setCloudStatus('access-denied'));
  f.onValue(f.ref(db,'.info/connected'),snapshot=>{
   connected=snapshot.val()===true;
   if(connected&&approved)f.onDisconnect(f.ref(db,`${root}/presence`)).set({...monitor.presence(),state:'offline',serverAt:f.serverTimestamp()}).then(flush).catch(()=>monitor.setCloudStatus('pending'));
   else if(!connected)monitor.setCloudStatus('offline');
  });
  setInterval(flush,config.heartbeatMs||60000);
  started=true;
  window.addEventListener('online',flush);
  document.addEventListener('visibilitychange',()=>{if(document.hidden||approved)flush();});
  }catch{monitor.setCloudStatus('pending');}
  finally{starting=false;}
 };
 connect();
 window.addEventListener('online',connect);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)connect();});
 setInterval(connect,config.heartbeatMs||60000);
}
