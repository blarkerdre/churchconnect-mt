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

// Unlock audio via a zero-gain WebAudio oscillator. Using a silent WebAudio
// node (instead of playing the notification <audio> element) satisfies mobile
// autoplay unlock requirements WITHOUT hijacking the phone's media volume
// stream — so refreshing the page no longer flips the volume rocker from
// Ring to Media on Android/iOS.
export function unlockAudio() {
  if (audioUnlocked) return Promise.resolve(true);
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      audioUnlocked = true;
      return Promise.resolve(true);
    }
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(ctx.currentTime + 0.01);
    const resume = ctx.resume ? ctx.resume() : Promise.resolve();
    return Promise.resolve(resume).then(() => {
      audioUnlocked = true;
      // Close shortly after so we don't hold an active AudioContext.
      setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 100);
      return true;
    }).catch(() => {
      audioUnlocked = true;
      return true;
    });
  } catch (err) {
    console.warn('[notification-alert] audio unlock threw:', err);
  }
  return Promise.resolve(false);
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
      const result = await Notification.requestPermission();
      if (result === 'granted') await unlockAudio();
      return result;
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
