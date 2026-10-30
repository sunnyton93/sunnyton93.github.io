// Reusable round engine: vocabulary and randomness are independent of the island UI.
const WordOrder = (() => {
 const hintLimit = 6;
 const stars = (used, mistakes = 0) => used <= 1 && mistakes === 0 ? 3 : used <= 3 ? 2 : 0;
 const letters = text => [...text.toUpperCase()].filter(char => /\p{L}/u.test(char));
 const mix = (items, random) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
   const j = Math.floor(random() * (i + 1));
   [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
 };
 function prepare(state) {
  if (!state.queue.length) { state.current = null; return; }
  state.current = state.queue[0];
  const answer = letters(state.current.en), previous = state.arrangements[state.current.id];
  let scrambled = mix(answer, state.random);
  // A bounded search also works with repeated letters and deterministic RNGs.
  const forbidden = value => value.join('') === answer.join('') || value.join('') === previous;
  if (forbidden(scrambled)) {
   outer: for (let i = 0; i < scrambled.length; i++) for (let j = i + 1; j < scrambled.length; j++) {
    const candidate = [...scrambled];
    [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
    if (!forbidden(candidate)) { scrambled = candidate; break outer; }
   }
   // With only two distinct arrangements, prefer unsolved over different.
   if (scrambled.join('') === answer.join('')) {
    const other = scrambled.findIndex(char => char !== scrambled[0]);
    if (other > 0) [scrambled[0], scrambled[other]] = [scrambled[other], scrambled[0]];
   }
  }
  state.arrangements[state.current.id] = scrambled.join('');
  // Tile IDs follow the shuffle, never the correct spelling; duplicates stay distinct.
  state.tiles = scrambled.map((letter, id) => ({id, letter}));
  state.slots = answer.map(() => null);
  state.lastHint = null;
  let slot = 0;
  state.layout = [...state.current.en.toUpperCase()].map(char => /\p{L}/u.test(char) ? slot++ : char);
 }
 function create(vocabulary, count = 12, random = Math.random) {
  const seen = new Set();
  const words = vocabulary.filter(word => {
   const key = word.en.trim().toUpperCase();
   if (seen.has(key) || !letters(key).length) return false;
   seen.add(key); return true;
  });
  if (words.length < count) throw new Error(`Ordena necesita ${count} palabras distintas.`);
  const chosen = mix(words, random).slice(0, count);
  const state = {chosen, queue: [...chosen], solved: [], attempts: 0, mistakes: 0, hintsUsed: 0, lastHint: null, arrangements: {}, random};
  prepare(state); return state;
 }
 function move(state, tileId, destination = null) {
  if (!state.current || !state.tiles.some(tile => tile.id === tileId)) return false;
  if (destination !== null && (!Number.isInteger(destination) || destination < 0 || destination >= state.slots.length)) return false;
  const source = state.slots.indexOf(tileId);
  if (source === destination) return false;
  const displaced = destination === null ? null : state.slots[destination];
  if (state.lastHint && (state.lastHint.tileId === tileId || state.lastHint.position === destination)) state.lastHint = null;
  if (source !== -1) state.slots[source] = displaced;
  if (destination !== null) state.slots[destination] = tileId;
  return true;
 }
 function hint(state) {
  if (!state.current || state.hintsUsed >= hintLimit) return null;
  const answer = letters(state.current.en);
  const unresolved = answer.flatMap((letter, position) => state.tiles[state.slots[position]]?.letter !== letter ? [position] : []);
  if (!unresolved.length) return null;
  const position = unresolved[Math.floor(state.random() * unresolved.length)];
  // Never take a letter from an already correct slot, even with repeated letters.
  const tile = state.tiles.find(tile => {
   const source = state.slots.indexOf(tile.id);
   return tile.letter === answer[position] && (source === -1 || answer[source] !== tile.letter);
  });
  if (!tile || !move(state, tile.id, position)) return null;
  state.hintsUsed++;
  state.lastHint = {position, tileId:tile.id};
  return state.lastHint;
 }
 function submit(state) {
  if (!state.current || state.slots.some(id => id === null)) return null;
  const answer = state.slots.map(id => state.tiles[id].letter).join('');
  const correct = answer === letters(state.current.en).join('');
  const word = state.queue.shift();
  state.attempts++;
  if (correct) state.solved.push(word.id);
  else {
   state.mistakes++;
   // At least one different pending word before a retry, unless this is the last.
   const position = state.queue.length ? 1 + Math.floor(state.random() * state.queue.length) : 0;
   state.queue.splice(position, 0, word);
  }
  prepare(state);
  return {correct, done: state.queue.length === 0};
 }
 return {create, move, submit, hint, hintLimit, stars};
})();

let wordOrderDrag = null;
function clearWordOrderFeedback() { document.querySelector('.order-feedback-overlay')?.remove(); }
function showWordOrderFeedback(round) {
 clearWordOrderFeedback();
 const overlay = document.createElement('div');
 overlay.className = 'order-feedback-overlay';
 overlay.innerHTML = wordOrderFeedbackView(round);
 // Mount outside the scrolling island and its filters: always center in the viewport.
 document.body.append(overlay);
}
function wordOrderEscape(value) { return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function wordOrderFeedbackView(round) {
 if (!round.orderFeedback) return '';
 const correct = round.orderFeedback === 'correct';
 const icon = correct ? '<path d="m16 29 9 9 18-21"/>' : '<path d="M43 25a16 16 0 1 0-3 16M43 13v13H30"/>';
 // A new key restarts the entrance even for consecutive answers of the same kind.
 return `<div class="order-feedback has-result ${correct?'is-correct':'is-wrong'}" data-play="order-feedback" data-id="${round.wordOrder.attempts}" role="status" aria-live="polite" aria-atomic="true">
  <span class="order-feedback-sparks" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✧</i></span>
  <span class="order-feedback-badge" aria-hidden="true"><svg viewBox="0 0 60 60">${icon}</svg></span>
  <span class="order-feedback-copy"><strong>${correct?'¡Correcto!':'¡Tú puedes!'}</strong><span>${wordOrderEscape(round.orderMessage)}</span></span>
 </div>`;
}
function wordOrderView(round) {
 const state = round.wordOrder, word = state.current;
 const disabled = round.pending ? 'disabled' : '';
 const tile = id => `<button class="order-tile" data-play="order-tile" data-id="${id}" aria-label="Letra ${wordOrderEscape(state.tiles[id].letter)}. Toca para ${state.slots.includes(id)?'devolver':'colocar'}." ${disabled}>${wordOrderEscape(state.tiles[id].letter)}</button>`;
 const slots = state.layout.map(position => typeof position === 'number'
  ? `<div class="order-slot ${state.slots[position]!==null?'is-filled':''} ${state.lastHint?.position===position?'is-hinted':''}" data-order-slot="${position}">${state.slots[position]===null?`<button data-play="order-slot" data-id="${position}" aria-label="Espacio ${position+1} vacío" ${disabled}>_</button>`:tile(state.slots[position])}</div>`
  : `<span class="order-separator" aria-label="${position===' '?'Separación entre palabras':'Guion'}">${position===' '?'':wordOrderEscape(position)}</span>`).join('');
 return `<section class="word-order-game" aria-labelledby="order-title">
  <div class="order-heading"><div class="order-heading-copy"><h2 id="order-title">¡Ordena las letras!</h2><p id="order-help">Arrastra las letras a los espacios y pulsa <b>Listo</b>.</p></div><button class="order-hint" data-play="order-hint" aria-label="Usar ayuda. ${WordOrder.hintLimit-state.hintsUsed} de ${WordOrder.hintLimit} disponibles en esta partida" ${disabled||state.hintsUsed>=WordOrder.hintLimit?'disabled':''}><span aria-hidden="true">✦</span> Ayuda <b>${WordOrder.hintLimit-state.hintsUsed}/${WordOrder.hintLimit}</b></button></div>
  <div class="order-picture" aria-hidden="true"><span>${wordIcon(word)}</span></div>
  <p class="order-spanish-word" lang="es">${wordOrderEscape(word.es)}</p>
  <div class="order-bank" data-order-bank role="group" aria-label="Letras disponibles" aria-describedby="order-help">${state.tiles.map(({id})=>`<span class="order-bank-place">${state.slots.includes(id)?'':tile(id)}</span>`).join('')}</div>
  <div class="order-slots" role="group" aria-label="Forma la palabra">${slots}</div>
  <div class="order-actions"><button class="order-clear" data-play="order-clear" ${disabled||state.slots.every(id=>id===null)?'disabled':''}>Vaciar</button><button class="primary order-submit" data-play="order-submit" ${disabled||state.slots.some(id=>id===null)?'disabled':''}>Listo <span aria-hidden="true">✓</span></button></div>
 </section>`;
}
function handleWordOrder(button) {
 const round = adventure;
 if (round?.mode !== 'order' || round.done || round.pending || document.hidden) return;
 const state = round.wordOrder, action = button.dataset.play;
 if (action === 'order-hint') {
  clearWordOrderDrag();
  const hint = WordOrder.hint(state);
  if (!hint) return;
  SoundWorld.play('correct'); render();
  (state.hintsUsed < WordOrder.hintLimit ? document.querySelector('.order-hint') : document.querySelector('.order-submit:not(:disabled),.order-bank .order-tile'))?.focus({preventScroll:true});
  return;
 }
 if (action === 'order-submit') {
  clearWordOrderDrag();
  const attemptedWord=state.current,attemptedAnswer=state.slots.map(id=>state.tiles[id]?.letter||'').join('');
  const result = WordOrder.submit(state);
  if (!result) return;
  recordWordAttempt(round,attemptedWord,result.correct?'correct':'incorrect',{answer:attemptedAnswer,reason:'spelling_submission'});
  round.step = state.solved.length; round.mistakes = state.mistakes;
  round.orderFeedback = result.correct ? 'correct' : 'wrong';
  round.orderMessage = result.correct ? '¡Una palabra más! Vamos con la siguiente.' : 'Esta palabra volverá más adelante. ¡Sigue jugando!';
  if (!result.correct && state.queue.length === 1) round.orderMessage = 'Mezclamos las letras. ¡Prueba otra vez!';
  SoundWorld.play(result.correct ? 'correct' : 'wrong');
  if (result.done) { finishAdventure(); render(); document.querySelector('[data-play="restart"]')?.focus({preventScroll:true}); return; }
  // Give the centered feedback time to be read before enabling the next word.
  round.pending = true; render(); showWordOrderFeedback(round);
  gameTurnTimer = setTimeout(() => {
   gameTurnTimer = null;
   if (adventure !== round || screen !== 'adventure') return;
   clearWordOrderFeedback();
   round.pending = false; render();
   document.querySelector('.order-bank .order-tile')?.focus({preventScroll:true});
  }, 1800);
  return;
 }
 if (action === 'order-clear') { state.slots.fill(null); state.lastHint = null; }
 else if (action === 'order-tile') {
  const id = Number(button.dataset.id), source = state.slots.indexOf(id);
  const destination = source === -1 ? state.slots.indexOf(null) : null;
  if (destination === -1 || !WordOrder.move(state, id, destination)) return;
 } else return;
 SoundWorld.play('tap'); render();
 const next = document.querySelector('.order-bank .order-tile') || document.querySelector('.order-submit');
 next?.focus({preventScroll:true});
}
function wordOrderResultView(round) {
 const used = round.wordOrder.hintsUsed;
 const result=round.stars===0?'Con más de 3 ayudas, esta partida no otorga estrellas.':round.stars===3?'¡Partida perfecta!':'¡Ganaste 2 estrellas!';
 const condition=used<=1&&round.wordOrder.mistakes>0?'Para ganar 3 estrellas, necesitas cero errores y como máximo una ayuda.':'';
 return `<div class="order-result-hints"><p>Usaste <b>${used} de ${WordOrder.hintLimit} ayudas</b> en esta partida.</p><p>${result}</p>${condition?`<small>${condition}</small>`:''}</div>`;
}
function clearWordOrderDrag() {
 const drag = wordOrderDrag; wordOrderDrag = null;
 if (!drag) return;
 drag.ghost?.remove(); drag.source.classList.remove('is-dragging'); drag.target?.classList.remove('is-drop-target');
 if (drag.source.hasPointerCapture?.(drag.pointerId)) drag.source.releasePointerCapture(drag.pointerId);
}
document.addEventListener('pointerdown', event => {
 const source = event.target.closest('.order-tile');
 if (!source || source.disabled || event.button !== 0 || !event.isPrimary || adventure?.mode !== 'order' || adventure.done || adventure.pending || document.hidden || source.closest('[inert]')) return;
 clearWordOrderDrag();
 wordOrderDrag = {source, round:adventure, id:Number(source.dataset.id), pointerId:event.pointerId, x:event.clientX, y:event.clientY, moved:false};
 source.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove', event => {
 const drag = wordOrderDrag;
 if (!drag || event.pointerId !== drag.pointerId) return;
 if (adventure !== drag.round || screen !== 'adventure') { clearWordOrderDrag(); return; }
 if (!drag.moved && Math.hypot(event.clientX-drag.x,event.clientY-drag.y) < 7) return;
 event.preventDefault();
 if (!drag.moved) {
  drag.moved = true; drag.source.classList.add('is-dragging');
  drag.ghost = document.createElement('span'); drag.ghost.className = 'order-drag-ghost';
  drag.ghost.textContent = drag.source.textContent; drag.ghost.setAttribute('aria-hidden','true'); document.body.append(drag.ghost);
 }
 drag.ghost.style.left = `${event.clientX}px`; drag.ghost.style.top = `${event.clientY}px`;
 const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-order-slot],[data-order-bank]');
 if (target !== drag.target) { drag.target?.classList.remove('is-drop-target'); target?.classList.add('is-drop-target'); drag.target = target; }
}, {passive:false});
document.addEventListener('pointerup', event => {
 const drag = wordOrderDrag;
 if (!drag || event.pointerId !== drag.pointerId) return;
 const moved = drag.moved;
 const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-order-slot],[data-order-bank]');
 clearWordOrderDrag();
 if (!moved) return;
 event.preventDefault();
 // Cancel only the click synthesized by this pointerup, never a later keyboard click.
 const suppress = click => { click.preventDefault(); click.stopImmediatePropagation(); };
 document.addEventListener('click', suppress, {capture:true, once:true});
 setTimeout(()=>document.removeEventListener('click',suppress,true),0);
 if (!target || adventure !== drag.round || screen !== 'adventure' || adventure.pending || adventure.done) return;
 const destination = target.dataset.orderSlot === undefined ? null : Number(target.dataset.orderSlot);
 if (WordOrder.move(adventure.wordOrder, drag.id, destination)) { SoundWorld.play('tap'); render(); }
});
document.addEventListener('pointercancel', event => { if (wordOrderDrag?.pointerId === event.pointerId) clearWordOrderDrag(); });
document.addEventListener('lostpointercapture', event => { if (wordOrderDrag?.pointerId === event.pointerId) clearWordOrderDrag(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearWordOrderDrag(); });
window.addEventListener('blur', clearWordOrderDrag);
