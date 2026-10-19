const SoundWorld = (()=>{
 const defaults={effects:.65,ambience:.35,music:.22};
 let volumes={...defaults};try{const saved=JSON.parse(localStorage.getItem('ximena-audio')||'{}');for(const key of Object.keys(defaults))if(Number.isFinite(saved[key]))volumes[key]=Math.max(0,Math.min(1,saved[key]));}catch{}
 let master,effects,ambience,music,noise,loopTimer,melodyStep=0,nextMusicBeat=0,blasterNoise,wordBank;
 const lastEffects=new Map();
 const effectIntervals={tap:90,open:160,close:120,select:100,dialogue:350,reveal:180,hide:180,shuffle:200,pick:100,step:240,land:120,slide:1200,warning:900,notification:1200,'shark-swim':4000,'shark-warning':1800,'shark-snap':900,'shark-bite':900,'shark-rise':1200,'shark-dive':1200,'shark-dodge':1200};
 const voices=new Set(),gainTargets=new WeakMap();
 function ramp(param,value){if(gainTargets.get(param)===value)return;gainTargets.set(param,value);const t=audioContext.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,.06);}
 function track(source,nodes=[]){voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());source.onended=null;};}
 function note(freq,delay=0,duration=.2,volume=.1,type='sine',bus=effects,endFreq){
  if(voices.size>48)return;
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),t=audioContext.currentTime+delay;
  oscillator.type=type;oscillator.frequency.setValueAtTime(freq,t);if(endFreq)oscillator.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  oscillator.connect(gain);gain.connect(bus);track(oscillator,[gain]);oscillator.start(t);oscillator.stop(t+duration+.03);
 }
 function breeze(duration=.3,volume=.08,frequency=900,bus=effects){
  if(voices.size>48)return;
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),t=audioContext.currentTime;
  source.buffer=noise;filter.type='lowpass';filter.frequency.value=frequency;
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+duration*.3);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  source.connect(filter);filter.connect(gain);gain.connect(bus);track(source,[filter,gain]);source.start();source.stop(t+duration+.02);
 }
 // Original Emoji Blaster synthesis, routed through the shared effects volume.
 function blasterSound(kind){
  if(voices.size>48)return;
  const t=audioContext.currentTime,gain=audioContext.createGain();
  gain.connect(effects);
  if(kind==='blaster-explosion'){
   if(!blasterNoise){
    blasterNoise=audioContext.createBuffer(1,Math.floor(audioContext.sampleRate*.2),audioContext.sampleRate);
    const samples=blasterNoise.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
   }
   const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter();
   source.buffer=blasterNoise;filter.type='lowpass';filter.frequency.value=1000;
   source.connect(filter);filter.connect(gain);
   gain.gain.setValueAtTime(.3,t);gain.gain.exponentialRampToValueAtTime(.01,t+.2);
   track(source,[filter,gain]);source.start(t);
  }else{
   const crash=kind==='blaster-crash',duration=crash?.5:.1,source=audioContext.createOscillator();
   source.type='square';source.connect(gain);
   source.frequency.setValueAtTime(crash?120:800,t);
   source.frequency.exponentialRampToValueAtTime(crash?10:100,t+duration);
   gain.gain.setValueAtTime(crash?.5:.1,t);gain.gain.exponentialRampToValueAtTime(.01,t+duration);
   track(source,[gain]);source.start(t);source.stop(t+duration);
  }
 }
 function init(){
  audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
  if(master)return;
  master=audioContext.createGain();const limiter=audioContext.createDynamicsCompressor();master.connect(limiter);limiter.connect(audioContext.destination);master.gain.value=0;
  effects=audioContext.createGain();ambience=audioContext.createGain();music=audioContext.createGain();for(const bus of [effects,ambience,music])bus.connect(master);
  noise=audioContext.createBuffer(1,audioContext.sampleRate*4,audioContext.sampleRate);const data=noise.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*5;}
  const sea=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),wave=audioContext.createGain();sea.buffer=noise;sea.loop=true;filter.type='lowpass';filter.frequency.value=650;wave.gain.value=.16;
  sea.connect(filter);filter.connect(wave);wave.connect(ambience);
  const lfo=audioContext.createOscillator(),depth=audioContext.createGain();lfo.frequency.value=.11;depth.gain.value=.10;lfo.connect(depth);depth.connect(wave.gain);sea.start();lfo.start();
 }
 // Original eight-bar island theme: a playful question and a warm answering phrase.
 const musicStepSeconds=60/108/2;
 const musicChords=[[60,64,67],[59,62,67],[57,60,64],[57,60,65],[60,64,67],[59,64,67],[57,60,65],[59,62,67]];
 const musicBass=[48,43,45,41,48,40,41,43];
 const musicMelody=[
  [72,null,76,79,81,79,76,null],
  [74,76,79,null,74,null,71,74],
  [76,null,79,81,84,null,81,79],
  [77,76,74,null,72,null,null,69],
  [72,76,79,null,84,83,81,79],
  [76,null,79,83,81,79,76,null],
  [77,null,81,79,77,76,74,72],
  [74,76,79,null,71,74,72,null]
 ];
 const pitch=midi=>440*2**((midi-69)/12);
 function shaker(delay){
  if(voices.size>42)return;
  const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),gain=audioContext.createGain(),t=audioContext.currentTime+delay;
  source.buffer=noise;filter.type='highpass';filter.frequency.value=1700;
  gain.gain.setValueAtTime(.09,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.065);
  source.connect(filter);filter.connect(gain);gain.connect(music);track(source,[filter,gain]);source.start(t);source.stop(t+.075);
 }
 function beat(){
  if(muted||document.hidden||audioContext?.state!=='running')return;
  const now=audioContext.currentTime;
  if(nextMusicBeat<now)nextMusicBeat=now+.035;
  while(nextMusicBeat<now+.12){
   const step=melodyStep%8,bar=Math.floor(melodyStep/8)%8,delay=nextMusicBeat-now;
   if(volumes.music>0){
    const melody=musicMelody[bar][step],chord=musicChords[bar];
    if(melody!==null){
     const duration=musicMelody[bar][step+1]===null ? .65 : .34;
     note(pitch(melody),delay,duration,.095,'sine',music);
     note(pitch(melody)*2,delay,.16,.012,'sine',music);
    }
    if(step%2===0){
     note(pitch(musicBass[bar]+(step===4?7:0)),delay,.42,.065,'sine',music);
     note(pitch(chord[(step/2)%3]),delay+.025,.32,.026,'triangle',music);
    }
    if(step===0||step===4){
     chord.forEach((midi,i)=>note(pitch(midi),delay+i*.018,.9,.012,'sine',music));
     note(105,delay,.12,.045,'sine',music,48);
    }
    if(step%2===1)shaker(delay);
   }
   if(volumes.ambience>0&&screen==='map'&&melodyStep%24===0){note(1050,delay,.16,.025,'sine',ambience,1450);note(1400,delay+.2,.18,.018,'sine',ambience,1100);}
   melodyStep++;nextMusicBeat+=musicStepSeconds;
  }
 }
 function sync(){
  DictionarySpeech.sync();
  // Try at startup; browsers that require a gesture keep this context suspended.
  if(!master&&!muted&&!document.hidden){try{init();}catch{return;}}
  if(!master)return;
  // Keep saved volumes intact; only soften the background while reading words.
  const backgroundLevel=screen==='dictionary'?.05:1,inActivity=['game','adventure'].includes(screen);
  ramp(master.gain,muted||document.hidden?0:.8);
  ramp(effects.gain,volumes.effects);
  ramp(ambience.gain,volumes.ambience*backgroundLevel*(inActivity?.4:1));
  ramp(music.gain,volumes.music*backgroundLevel*(inActivity?.45:1));
  if(muted||document.hidden){clearInterval(loopTimer);loopTimer=null;nextMusicBeat=0;for(const voice of voices){try{voice.stop();}catch{}voice.onended?.();}if(audioContext.state==='running')audioContext.suspend().catch(()=>{});}
  else {if(['suspended','interrupted'].includes(audioContext.state))audioContext.resume().catch(()=>{});if(volumes.music>0||(volumes.ambience>0&&screen==='map')){if(!loopTimer){nextMusicBeat=0;loopTimer=setInterval(beat,50);}}else{clearInterval(loopTimer);loopTimer=null;nextMusicBeat=0;}}
  if(!muted&&!document.hidden&&screen==='dictionary')loadWordBank().catch(()=>{});
 }
 function loadWordBank(){
  if(!wordBank)wordBank=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{
    const [metadata,audio]=await Promise.all(['/audio/dictionary-en-us.json','/audio/dictionary-en-us.mp3'].map(url=>fetch(url,{signal:controller.signal})));
    if(!metadata.ok||!audio.ok)throw new Error('Dictionary audio unavailable');
    const [index,bytes]=await Promise.all([metadata.json(),audio.arrayBuffer()]);
    if(index.version!==1||index.language!=='en-US'||!index.clips)throw new Error('Invalid dictionary audio index');
    const buffer=await audioContext.decodeAudioData(bytes);
    return {buffer,clips:index.clips};
   }finally{clearTimeout(timer);}
  })().catch(error=>{wordBank=null;throw error;});
  return wordBank;
 }
 function speakWord(text,events){
  let cancelled=false,source;
  const cancel=()=>{
   cancelled=true;
   if(source){source.onended=null;voices.delete(source);try{source.stop();}catch{}source.disconnect();source=null;}
  };
  (async()=>{
   // Resume synchronously from the tap, before fetching/decoding (Safari).
   init();sync();
   const [,bank]=await Promise.all([audioContext.resume(),loadWordBank()]);
   if(cancelled)return;
   if(muted||document.hidden||screen!=='dictionary'||audioContext.state!=='running')throw new Error('Playback interrupted');
   const clip=bank.clips[text];
   if(!Array.isArray(clip)||clip.length!==2||!clip.every(Number.isFinite)||clip[0]<0||clip[1]<=0||clip[0]+clip[1]>bank.buffer.duration+.03)throw new Error('Missing dictionary recording');
   source=audioContext.createBufferSource();source.buffer=bank.buffer;
   // Same context, effects bus, master and output as the game. Never use the
   // separate OS speech session, which can stay on the iPad during AirPlay.
   source.connect(effects);track(source);
   const cleanup=source.onended;
   source.onended=()=>{cleanup();source=null;if(!cancelled)events.end();};
   source.start(0,clip[0],clip[1]);events.start();
  })().catch(()=>{if(!cancelled){cancel();events.error();}});
  return cancel;
 }
 function play(kind){
  if(muted||document.hidden)return;
  try{
   init();sync();
   const now=performance.now(),interval=effectIntervals[kind]??65;
   if(volumes.effects===0||now-(lastEffects.get(kind)??-Infinity)<interval)return;
   lastEffects.set(kind,now);
   const sequence=(frequencies,spacing=.11,duration=.27)=>frequencies.forEach((f,i)=>note(f,i*spacing,duration,.11));
   switch(kind){
    case 'open':note(440,0,.15,.045,'sine',effects,660);note(880,.06,.16,.035);break;
    case 'select':note(740,0,.09,.045,'triangle',effects,920);break;
    case 'dialogue':note(360,0,.09,.035,'sine',effects,480);note(430,.10,.1,.03,'sine',effects,560);note(500,.21,.1,.025);break;
    case 'reveal':breeze(.22,.055,2000);note(620,.05,.14,.035,'sine',effects,930);break;
    case 'hide':breeze(.18,.045,1300);note(600,0,.13,.03,'sine',effects,390);break;
    case 'shuffle':breeze(.2,.065,1700);note(460,.03,.07,.022);note(560,.12,.08,.025);break;
    case 'pick':note(540,0,.08,.04,'sine',effects,720);break;
    case 'place':note(460,0,.09,.035,'sine',effects,310);break;
    case 'ready':note(523,0,.14,.06);note(784,.12,.2,.065);break;
    case 'draw':breeze(.16,.035,1600);note(220,0,.2,.025,'triangle',effects,420);break;
    case 'step':note(170,0,.065,.022,'sine',effects,95);break;
    case 'land':note(155,0,.13,.045,'sine',effects,70);breeze(.09,.035,600);break;
    case 'slide':note(230,0,.2,.03,'triangle',effects,150);breeze(.2,.025,850);break;
    case 'warning':note(660,0,.1,.04);note(660,.16,.1,.03);break;
    case 'notification':note(660,0,.16,.04);note(880,.1,.23,.035);break;
    case 'blaster-laser':case 'blaster-explosion':case 'blaster-crash':blasterSound(kind);break;
    case 'pirate-swish':breeze(.3,.09,1800);note(360,.05,.3,.075,'sine',effects,180);note(240,.24,.18,.055,'triangle',effects,400);break;
    case 'arrow':breeze(.3,.11,2400);note(250,0,.13,.05,'triangle',effects,620);break;
    case 'balloon-pop':breeze(.08,.15,1500);note(650,0,.1,.09,'sine',effects,130);break;
    case 'departure':breeze(1.2,.12,1000);sequence([261.63,392,523.25,659.25],.18,.55);note(196,.15,.7,.06,'triangle');break;
    case 'arrival':sequence([523.25,783.99,1046.5,1318.5],.13,.5);breeze(.4,.06,1700);break;
    case 'combo':sequence([659.25,783.99,1046.5,1318.5],.08,.25);break;
    case 'correct':sequence([523.25,659.25,783.99]);break;
    case 'wrong':note(260,0,.18,.13,'triangle',effects,190);note(210,.13,.22,.10,'triangle',effects,150);break;
    case 'lose':sequence([392,329.63,261.63,220],.18,.45);break;
    case 'win':sequence([523.25,659.25,783.99,1046.5,783.99,1046.5],.14,.5);note(261.63,.55,.9,.065);break;
    case 'treasure':breeze(.5,.09);sequence([659,880,1046,1318],.13,.55);break;
    case 'bubble':note(500,0,.12,.12,'sine',effects,1550);break;
    case 'fish':sequence([780,1040],.09,.15);break;
    case 'turtle':sequence([392,523],.13,.25);break;
    case 'octopus':sequence([440,660,550],.1,.2);break;
    case 'mascot':sequence([523,659,523,784],.1,.2);break;
    case 'flip':breeze(.17,.10,1500);note(760,.08,.14,.045);break;
    case 'travel':breeze(1,.12,1300);sequence([392,523.25,659.25,783.99,1046.5],.14,.5);break;
    case 'retry':sequence([330,440,660],.12,.25);break;
    case 'jump':note(350,0,.18,.09,'sine',effects,850);break;
    case 'sink':breeze(.55,.12,500);note(240,0,.3,.08,'sine',effects,90);break;
    case 'splash':breeze(.32,.12,700);note(460,.04,.17,.035,'sine',effects,220);break;
    case 'shark-swim':{const pitch=330+Math.random()*100;breeze(.28,.035,700);note(pitch,.04,.13,.018,'sine',effects,pitch*1.8);break;}
    case 'shark-warning':note(165,0,.14,.055,'triangle',effects,220);note(220,.19,.15,.06,'triangle',effects,310);note(330,.4,.16,.045,'sine',effects,440);breeze(.5,.025,500);break;
    case 'shark-rise':breeze(.32,.085,1800);note(290,0,.28,.045,'sine',effects,920);note(650,.09,.16,.025,'sine',effects,1300);break;
    case 'shark-dive':breeze(.48,.12,750);note(220,.04,.22,.045,'sine',effects,95);note(680,.12,.12,.03,'sine',effects,210);note(440,.25,.1,.02,'sine',effects,160);break;
    case 'shark-snap':breeze(.09,.09,1300);note(300,0,.1,.05,'triangle',effects,85);break;
    case 'shark-bite':breeze(.2,.13,550);note(190,0,.16,.075,'triangle',effects,75);note(520,.08,.11,.045,'sine',effects,250);break;
    case 'shark-dodge':note(520,.06,.15,.035,'sine',effects,780);note(880,.19,.2,.03,'sine',effects,1040);break;
    case 'mordisquitos-arrive':breeze(.45,.075,850);note(160,0,.3,.05,'triangle',effects,230);note(330,.12,.28,.035,'sine',effects,180);break;
    case 'mordisquitos-talk':
     [190,245,210,275,200,230].forEach((pitch,i)=>{note(pitch,i*.14,.105,.055,'triangle',effects,pitch*.82);note(pitch*2.7,i*.14+.015,.075,.018,'sine',effects,pitch*2.2);});break;
    case 'mordisquitos-laugh':
     [240,215,195,165].forEach((pitch,i)=>{note(pitch,i*.21,.14,.075,'triangle',effects,pitch*.62);note(pitch*3,i*.21+.025,.09,.025,'sine',effects,pitch*1.7);});break;
    case 'mordisquitos-take':breeze(.42,.09,1700);note(320,0,.35,.045,'sine',effects,720);break;
    case 'mordisquitos-coin':note(1350,0,.11,.04,'sine',effects,950);note(2100,.035,.12,.02,'sine',effects,1400);break;
    case 'mordisquitos-finish':note(220,0,.19,.055,'triangle',effects,110);note(640,.07,.16,.035,'sine',effects,320);break;
    case 'locked':sequence([330,294],.13,.23);break;
    case 'close':note(540,0,.15,.07,'sine',effects,340);break;
    default:note(680,0,.11,.065,'sine',effects,880);
   }
  }catch{/* Browsers without audio can still run the game. */}
 }
 function setVolume(key,value){if(!(key in defaults))return;volumes[key]=Math.max(0,Math.min(1,Number(value)));try{localStorage.setItem('ximena-audio',JSON.stringify(volumes));}catch{}sync();}
 function previewVolume(key){
  if(!(key in defaults)||muted||document.hidden||volumes[key]===0)return;
  try{
   init();sync();const now=performance.now(),id=`volume:${key}`;
   if(now-(lastEffects.get(id)??-Infinity)<180)return;lastEffects.set(id,now);
   if(key==='ambience')breeze(.35,.16,900,ambience);
   else note(key==='music'?523:680,0,.18,.09,'sine',key==='music'?music:effects);
  }catch{/* Volume controls also work without audio support. */}
 }
 function toggle(){muted=!muted;try{localStorage.setItem('ximena-audio-muted',String(muted));}catch{}if(!muted)play('select');else sync();}
 return {play,sync,toggle,setVolume,previewVolume,speakWord,get volumes(){return {...volumes};}};
})();
// Recorded words share the game's audio route, including screen mirroring.
const DictionarySpeech=(()=>{
 const supported=Boolean(window.AudioContext||window.webkitAudioContext);
 let active=null;
 function hint(){
  if(!supported)return 'Este navegador no puede reproducir el audio de las palabras.';
  if(muted)return 'Activa el sonido con ♪ y toca una carta para escucharla en inglés.';
  if(SoundWorld.volumes.effects===0)return 'Sube el volumen de Efectos para escuchar las palabras.';
  return 'Toca una carta para escucharla en inglés.';
 }
 function status(message){const element=document.querySelector('.dictionary-audio-status');if(element)element.textContent=message;}
 function clear(){
  const previous=active;active=null;
  if(previous){clearTimeout(previous.timer);previous.cancel?.();previous.card.classList.remove('is-speaking','is-speech-pending');previous.button.removeAttribute('aria-busy');}
 }
 function stop(message=hint()){
  clear();status(message);
 }
 function speak(button){
  const card=button.closest('.word-card'),text=card?.querySelector('h2')?.textContent.trim();
  if(screen!=='dictionary'||document.hidden||!button.isConnected||!text)return;
  stop();
  if(!supported||muted||SoundWorld.volumes.effects===0)return;
  try{
   const request={card,button,timer:null,cancel:null};active=request;
   const fail=message=>{if(active===request)stop(message);};
   const timeout=()=>fail('No se pudo reproducir la palabra. Toca la carta para intentarlo de nuevo.');
   card.classList.add('is-speech-pending');button.setAttribute('aria-busy','true');status('Preparando la pronunciación…');
   request.timer=setTimeout(timeout,18000);
   request.cancel=SoundWorld.speakWord(text,{start(){
    if(active!==request)return;
    clearTimeout(request.timer);request.timer=setTimeout(timeout,15000);
    card.classList.remove('is-speech-pending');card.classList.add('is-speaking');button.removeAttribute('aria-busy');
    status(`Escuchando: ${text}`);
   },end(){if(active===request){clear();status(hint());}},error(){
    fail(navigator.onLine?'No se pudo cargar la pronunciación. Toca la carta para intentarlo de nuevo.':'Conéctate para descargar la pronunciación y vuelve a tocar la carta.');
   }});
  }catch{stop('No se pudo reproducir la palabra. Toca la carta para intentarlo de nuevo.');}
 }
 function sync(){
  if(active&&(muted||document.hidden||screen!=='dictionary'||!active.card.isConnected||SoundWorld.volumes.effects===0))stop();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',()=>stop());
 return {speak,stop,sync,hint};
})();

document.addEventListener('visibilitychange',()=>SoundWorld.sync());
// Retrying inside a real gesture unlocks the SAME output on Safari/iPad. Keep
// listening for later OS interruptions, but never override an explicit mute.
function resumeSoundFromGesture(event){
 if(!event.isTrusted||muted||document.hidden||audioContext?.state==='running')return;
 if(event.target.closest?.('[data-action="sound"],[data-voyage="sound"]'))return;
 if(event.type==='keydown'&&(event.repeat||['Shift','Control','Alt','Meta'].includes(event.key)))return;
 SoundWorld.sync();
}
for(const event of ['pointerup','touchend','click','keydown'])document.addEventListener(event,resumeSoundFromGesture,{capture:true,passive:true});
// Only unowned button actions receive a fallback. Games and dialogs sound at
// their actual state change, including keyboard, touch and asynchronous results.
document.addEventListener('click',event=>{
 const button=event.target.closest('button,a[data-action]');if(!button||button.matches(':disabled')||button.getAttribute('aria-disabled')==='true'||button.closest('[inert]'))return;
 const {action,play,island,ocean,islandToy,roomDecoy,luceroRoute,voyage}=button.dataset;
 if(play||island!==undefined||ocean||islandToy||roomDecoy!==undefined||luceroRoute!==undefined||voyage||button.dataset.answer||['messi','new-islands'].includes(button.dataset.ui)||['sound','next','game','pronounce','coin-redeem','select-profile','route-gate'].includes(action))return;
 if(button.matches('[data-archery-bow],.platform-owl,.marine-close,.marine-continue,.inactivity-close,.inactivity-continue,.recenter-map'))return;
 const cue=action==='flip'?'flip':action==='preview'?'locked':action==='map'?'close':
  ['dictionary','collection','profile','audio-settings','coin-shop'].includes(action)||button.dataset.lesson!==undefined?'open':
  button.dataset.ui==='mission'?(button.getAttribute('aria-expanded')==='true'?'close':'open'):button.dataset.theme?'select':'tap';
 SoundWorld.play(cue);
},true);
// Preview the chosen mix on release or keyboard change, not on every drag frame.
document.addEventListener('change',event=>{if(event.target.dataset.volume)SoundWorld.previewVolume(event.target.dataset.volume);});
