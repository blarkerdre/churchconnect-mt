let audioElement = null;

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
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
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

export function triggerNotificationAlert(title, message) {
  playNotificationSound();
  vibrateDevice();
  showBrowserNotification(title, message);
}
