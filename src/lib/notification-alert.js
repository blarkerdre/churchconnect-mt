let audioElement = null;
let swRegistration = null;

function getAudio() {
  if (!audioElement) {
    audioElement = new Audio('/sounds/notification.mp3');
    audioElement.volume = 0.5;
  }
  return audioElement;
}

export function playNotificationSound() {
  try {
    const audio = getAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Audio not supported
  }
}

export function vibrateDevice() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration not supported
  }
}

export function showBrowserNotification(title, body) {
  try {
    if (Notification.permission !== 'granted') return;

    const options = {
      body: body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'app-notification',
    };

    // Prefer SW showNotification (works in background on mobile)
    if (swRegistration) {
      swRegistration.showNotification(title, options).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch {
    // Notifications not supported
  }
}

export function requestNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch {
    // Not supported
  }
}

export async function registerServiceWorker() {
  try {
    if (!('serviceWorker' in navigator)) return;

    // Guard: skip in iframes and preview hosts
    const isInIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreview =
      host.includes('id-preview--') ||
      host.includes('lovableproject.com') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (isInIframe || isPreview) {
      // Unregister any stale SW in preview/iframe
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach((r) => r.unregister());
      return;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    swRegistration = reg;
  } catch {
    // SW registration failed
  }
}

export function triggerNotificationAlert(title, message) {
  playNotificationSound();
  vibrateDevice();
  showBrowserNotification(title, message);
}
