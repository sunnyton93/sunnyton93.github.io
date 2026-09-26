(() => {
 const syncVisibility = () => document.documentElement.classList.toggle('app-hidden', document.hidden);
 document.addEventListener('visibilitychange', syncVisibility);
 window.addEventListener('pageshow', syncVisibility);
 syncVisibility();

 // Home Screen metadata still works over LAN HTTP; offline storage needs HTTPS.
 if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
 window.addEventListener('load', async () => {
  try {
   const registration = await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
   let lastCheck = Date.now();
   document.addEventListener('visibilitychange', () => {
    if (document.hidden || Date.now() - lastCheck < 60 * 60 * 1000) return;
    lastCheck = Date.now();
    registration.update().catch(() => {});
   });
  } catch (error) {
   // A storage restriction or disconnected first visit must not prevent playing.
   console.warn('No se pudo preparar el modo sin conexión.', error);
  }
 }, {once: true});
})();
