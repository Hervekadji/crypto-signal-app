// utils/notify.js
//
// Sur Android Chrome, `new Notification(...)` est bloqué silencieusement —
// il faut passer par ServiceWorkerRegistration.showNotification(). Sur
// desktop, les deux fonctionnent, donc on utilise systématiquement la
// méthode service worker avec repli sur le constructeur direct si jamais
// le service worker n'est pas disponible.

/**
 * @param {string} title
 * @param {NotificationOptions} [options]
 */
export async function showNotification(title, options = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // on retente avec le constructeur direct ci-dessous
  }

  try {
    new Notification(title, options);
  } catch {
    // Certains navigateurs (dont Chrome Android) refusent le constructeur
    // direct sans lever d'erreur exploitable — on abandonne silencieusement
    // plutôt que de casser le flux principal de l'app.
  }
}
