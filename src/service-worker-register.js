if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    }).then(registration => registration.update()).catch(error => {
      console.warn('Nearer offline cache could not start.', error);
    });
  }, { once: true });
}
