import React, { useState } from 'react';
import { showNotification } from '../utils/notify.js';

/**
 * Bouton générique d'activation des notifications navigateur, avec un
 * bouton de test séparé pour vérifier le mécanisme indépendamment de tout
 * vrai signal (utile pour diagnostiquer : est-ce que les notifications
 * marchent du tout, ou juste qu'aucun signal n'a encore changé ?).
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

  const sendTestNotification = () => {
    if (permission !== 'granted') return;
    showNotification('Test de notification', {
      body: "Si tu vois ceci, le mécanisme fonctionne — le souci vient d'ailleurs (signal pas encore changé, ou onglet mis en pause par Android).",
      tag: 'test-notification'
    });
  };

  let label = labelOff;
  if (permission === 'unsupported') label = 'Notifications non supportées';
  else if (permission === 'denied') label = 'Notifications bloquées par le navigateur';
  else if (permission === 'granted') label = enabled ? labelOn : 'Notifications en pause';

  return (
    <div className="notif-toggle-group">
      <button
        className="notif-btn"
        onClick={handleClick}
        disabled={permission === 'unsupported' || permission === 'denied'}
        data-active={permission === 'granted' && enabled}
      >
        {label}
      </button>
      {permission === 'granted' && (
        <button className="notif-test-btn" onClick={sendTestNotification}>
          Tester
        </button>
      )}
    </div>
  );
}
