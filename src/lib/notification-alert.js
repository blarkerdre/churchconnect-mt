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

// Unlock audio on first real user interaction. We play UNMUTED at very low
// volume — some mobile browsers (notably iOS Safari) do not count a muted
// play() as a valid autoplay unlock, so later unmuted play() calls from
// realtime callbacks stay blocked.
function unlockAudio() {
  if (audioUnlocked) return Promise.resolve(true);
  try {
    const a = getAudio();
    const prevVolume = a.volume;
    a.volume = 0.01;
    a.currentTime = 0;
    const p = a.play();
    if (p && p.then) {
      return p.then(() => {
        a.pause();
        a.currentTime = 0;
        a.volume = prevVolume;
        audioUnlocked = true;
        return true;
      }).catch((err) => {
        a.volume = prevVolume;
        console.warn('[notification-alert] audio unlock blocked:', err?.name || err);
        return false;
      });
    }
  } catch (err) {
    console.warn('[notification-alert] audio unlock threw:', err);
  }
  return Promise.resolve(false);
}

function setupAudioUnlock() {
  const handler = () => {
    unlockAudio();
    window.removeEventListener('touchstart', handler);
    window.removeEventListener('click', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('touchstart', handler, { once: true });
  window.addEventListener('click', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}

if (typeof window !== 'undefined') {
  setupAudioUnlock();
}

export function playNotificationSound({ repeat = false } = {}) {
  try {
    const audio = getAudio();
    audio.volume = 1.0;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) {
      p.catch((err) => {
        console.warn('[notification-alert] play() blocked:', err?.name || err);
      });
    }
    if (repeat) {
      setTimeout(() => {
        try {
          const a = getAudio();
          a.volume = 1.0;
          a.currentTime = 0;
          const p2 = a.play();
          if (p2 && p2.catch) p2.catch(() => {});
        } catch { /* ignore */ }
      }, 1500);
    }
  } catch (err) {
    console.warn('[notification-alert] audio not supported:', err);
  }
}

// Plays the chime at full volume from a user gesture — used by the
// Enable / Test sound buttons so the user can verify audio works.
export async function testNotificationSound() {
  await unlockAudio();
  playNotificationSound({ repeat: false });
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
    if (typeof Notification === 'undefined') return;
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
    const reg = await navigator.serviceWorker.ready;
    swRegistration = reg;
  } catch {
    // No notification service worker is active
  }
}

export function triggerNotificationAlert(title, message) {
  const hidden = typeof document !== 'undefined' && document.hidden;
  console.info('[notification-alert] triggered', { title, hidden, audioUnlocked });
  playNotificationSound({ repeat: hidden });
  vibrateDevice();
  showBrowserNotification(title, message);
}
