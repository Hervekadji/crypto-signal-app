// public/sw.js
// Service worker minimal — sa seule raison d'être ici est de permettre
// l'affichage de notifications sur Android Chrome, qui exige de passer par
// ServiceWorkerRegistration.showNotification() plutôt que le constructeur
// `new Notification()` direct (qui fonctionne sur desktop mais est bloqué
// silencieusement sur Android).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Au clic sur une notification, on ramène l'utilisateur sur l'app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
