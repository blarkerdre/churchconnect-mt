let audioElement = null;
let swRegistration = null;
let audioUnlocked = false;

function getAudio() {
  if (!audioElement) {
    audioElement = new Audio('/sounds/notification.mp3');
    audioElement.volume = 1.0;
    audioElement.preload = 'auto';
  }
  return audioElement;
}

// Unlock audio on first user interaction (required by mobile browsers)
function setupAudioUnlock() {
  if (audioUnlocked) return;
  const unlock = () => {
    try {
      const a = getAudio();
      a.muted = true;
      a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        audioUnlocked = true;
      }).catch(() => {});
    } catch {
      // ignore
    }
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

if (typeof window !== 'undefined') {
  setupAudioUnlock();
}

export function playNotificationSound({ repeat = false } = {}) {
  try {
    const audio = getAudio();
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    if (repeat) {
      setTimeout(() => {
        try {
          const a = getAudio();
          a.currentTime = 0;
          const p2 = a.play();
          if (p2 && p2.catch) p2.catch(() => {});
        } catch { /* ignore */ }
      }, 1500);
    }
  } catch {
    // Audio not supported
  }
}

export function vibrateDevice(pattern) {
  try {
    navigator.vibrate?.(pattern || [300, 150, 300, 150, 500]);
  } catch {
    // Vibration not supported
  }
}

export function showBrowserNotification(title, body) {
  try {
    if (Notification.permission !== 'granted') return;

    const options = {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [300, 150, 300, 150, 500],
      tag: 'app-notification',
      requireInteraction: false,
    };

    if (swRegistration) {
      swRegistration.showNotification(title, options).catch(() => {
        try { new Notification(title, options); } catch { /* ignore */ }
      });
    } else {
      try { new Notification(title, options); } catch { /* ignore */ }
    }
  } catch {
    // Notifications not supported
  }
}

export async function requestNotificationPermission() {
  try {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return 'denied';
  }
}

export async function registerServiceWorker() {
  try {
    if (!('serviceWorker' in navigator)) return;

    const isInIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreview =
      host.includes('id-preview--') ||
      host.includes('lovableproject.com') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (isInIframe || isPreview) {
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
  const hidden = typeof document !== 'undefined' && document.hidden;
  playNotificationSound({ repeat: hidden });
  vibrateDevice();
  showBrowserNotification(title, message);
}
