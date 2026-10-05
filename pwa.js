(() => {
 const syncVisibility = () => document.documentElement.classList.toggle('app-hidden', document.hidden);
 document.addEventListener('visibilitychange', syncVisibility);
 window.addEventListener('pageshow', syncVisibility);
 syncVisibility();

 // Home Screen metadata still works over LAN HTTP; offline storage needs HTTPS.
 if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
 window.addEventListener('load', async () => {
  try {
   let registration, checking = false, applying = false, reloading = false, activatedUpdate = false;
   let banner, applyButton, message, applyTimeout;
   const reload = () => {
    if (reloading) return;
    reloading = true;
    location.reload();
   };
   const showUpdate = () => {
    if (banner) return;
    banner = document.createElement('aside');
    banner.className = 'app-update';
    banner.setAttribute('aria-labelledby', 'app-update-title');
    banner.innerHTML = '<div><strong id="app-update-title">Hay una actualización disponible</strong><p role="status">Recarga para usar la nueva versión. Tu progreso guardado se conserva; la partida en curso se reiniciará.</p></div><button type="button">Actualizar ahora</button>';
    document.body.append(banner);
    message = banner.querySelector('p');
    applyButton = banner.querySelector('button');
    applyButton.addEventListener('click', () => {
     if (applying) return;
     const waiting = registration?.waiting;
     if (!waiting && !activatedUpdate) { checkForUpdate(); return; }
     applying = true;
     applyButton.disabled = true;
     applyButton.textContent = 'Actualizando…';
     applyTimeout = setTimeout(() => {
      applying = false;
      reloading = false;
      applyButton.disabled = false;
      applyButton.textContent = 'Reintentar actualización';
      message.textContent = 'No se pudo recargar. Revisa tu conexión e inténtalo otra vez. Tu progreso guardado se conserva.';
     }, 15000);
     if (waiting) waiting.postMessage({type: 'SKIP_WAITING'});
     else reload();
    });
   };
   navigator.serviceWorker.addEventListener('controllerchange', () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;
    if (applying) { activatedUpdate = true; reload(); }
    else controller.postMessage({type: 'GET_VERSION'});
   });
   const checkForUpdate = async () => {
    if (checking || document.hidden || !navigator.onLine || !registration) return;
    checking = true;
    try {
     await registration.update();
     if (registration.waiting) showUpdate();
    } catch { /* Keep playing with the installed version when offline. */ }
    finally { checking = false; }
   };
   registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
   const watchInstalling = () => {
    const installing = registration.installing;
    if (!installing) return;
    const isUpdate = Boolean(registration.active);
    installing.addEventListener('statechange', () => {
     if (installing.state === 'installed' && isUpdate) showUpdate();
    });
   };
   registration.addEventListener('updatefound', watchInstalling);
   watchInstalling();
   if (registration.waiting) showUpdate();
   // A different window may already have activated a newer worker before this
   // page attached its listeners. Compare with the version of the loaded HTML.
   const pageVersion = document.querySelector('meta[name="app-version"]')?.content;
   navigator.serviceWorker.addEventListener('message', event => {
    if (event.source === navigator.serviceWorker.controller && event.data?.type === 'APP_VERSION' && pageVersion && event.data.version !== pageVersion) {
     activatedUpdate = true;
     if (applying) reload();
     else showUpdate();
    }
   });
   navigator.serviceWorker.controller?.postMessage({type: 'GET_VERSION'});
   document.addEventListener('visibilitychange', checkForUpdate);
   window.addEventListener('pageshow', checkForUpdate);
   window.addEventListener('online', checkForUpdate);
   setInterval(checkForUpdate, 60000);
  } catch (error) {
   // A storage restriction or disconnected first visit must not prevent playing.
   console.warn('No se pudo preparar el modo sin conexión.', error);
  }
 }, {once: true});
})();
