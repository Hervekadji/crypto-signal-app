import React, { useState } from 'react';

/**
 * Bouton générique d'activation des notifications navigateur.
 * Réutilisé à la fois pour les alertes de signal (prix) et les alertes
 * d'actualités à impact détecté.
 */
export default function NotificationToggle({ enabled, onToggle, labelOn = 'Notifications activées ✓', labelOff = 'Activer les notifications' }) {
  const [permission, setPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const handleClick = async () => {
    if (permission === 'unsupported') return;
    if (permission === 'granted') {
      onToggle(!enabled);
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') onToggle(true);
  };

  let label = labelOff;
  if (permission === 'unsupported') label = 'Notifications non supportées';
  else if (permission === 'denied') label = 'Notifications bloquées par le navigateur';
  else if (permission === 'granted') label = enabled ? labelOn : 'Notifications en pause';

  return (
    <button
      className="notif-btn"
      onClick={handleClick}
      disabled={permission === 'unsupported' || permission === 'denied'}
      data-active={permission === 'granted' && enabled}
    >
      {label}
    </button>
  );
}
