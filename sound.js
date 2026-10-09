const SoundWorld = (()=>{
 const defaults={effects:.65,ambience:.35,music:.22};
 let volumes={...defaults};try{const saved=JSON.parse(localStorage.getItem('ximena-audio')||'{}');for(const key of Object.keys(defaults))if(Number.isFinite(saved[key]))volumes[key]=Math.max(0,Math.min(1,saved[key]));}catch{}
 let master,effects,ambience,music,noise,loopTimer,melodyStep=0,nextMusicBeat=0,lastEffect=0,blasterNoise,wordBank;
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
  if(!master)return;
  // Keep saved volumes intact; only soften the background while reading words.
  const backgroundLevel=screen==='dictionary'?.05:1,inActivity=['game','adventure'].includes(screen);
  ramp(master.gain,muted||document.hidden?0:.8);
  ramp(effects.gain,volumes.effects);
  ramp(ambience.gain,volumes.ambience*backgroundLevel*(inActivity?.4:1));
  ramp(music.gain,volumes.music*backgroundLevel*(inActivity?.45:1));
  if(muted||document.hidden){clearInterval(loopTimer);loopTimer=null;nextMusicBeat=0;for(const voice of voices){try{voice.stop();}catch{}voice.onended?.();}if(audioContext.state==='running')audioContext.suspend().catch(()=>{});}
  else {if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});if(volumes.music>0||(volumes.ambience>0&&screen==='map')){if(!loopTimer){nextMusicBeat=0;loopTimer=setInterval(beat,50);}}else{clearInterval(loopTimer);loopTimer=null;nextMusicBeat=0;}}
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
   const now=performance.now();if(kind==='tap'&&now-lastEffect<70)return;lastEffect=now;
   const sequence=(frequencies,spacing=.11,duration=.27)=>frequencies.forEach((f,i)=>note(f,i*spacing,duration,.11));
   switch(kind){
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
    case 'locked':sequence([330,294],.13,.23);break;
    case 'close':note(540,0,.15,.07,'sine',effects,340);break;
    default:note(680,0,.11,.065,'sine',effects,880);
   }
  }catch{/* Browsers without audio can still run the game. */}
 }
 function setVolume(key,value){if(!(key in defaults))return;volumes[key]=Math.max(0,Math.min(1,Number(value)));try{localStorage.setItem('ximena-audio',JSON.stringify(volumes));}catch{}sync();}
 function toggle(){muted=!muted;if(!muted)play('tap');else sync();}
 return {play,sync,toggle,setVolume,speakWord,get volumes(){return {...volumes};}};
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
// Clicks only: pointer movement and dragging do not make button sounds.
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||button.disabled||button.closest('[inert]'))return;
 if(['find','memory','connect','memory-shell','memory-pearl'].includes(button.dataset.play)||button.dataset.island!==undefined||button.dataset.ocean||button.dataset.answer||['sound','next','game','pronounce'].includes(button.dataset.action))return;
 SoundWorld.play(button.dataset.action==='flip'?'flip':button.dataset.action==='preview'?'locked':button.dataset.action==='map'?'close':'tap');
},true);
