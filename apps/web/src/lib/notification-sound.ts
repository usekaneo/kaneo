const NOTIFICATION_SOUND_SRC = "/tasks-notification.mp3";
const NOTIFICATION_SOUND_VOLUME = 0.9;

let notificationAudio: HTMLAudioElement | null = null;
let isNotificationSoundPrimed = false;
let isNotificationSoundPlaying = false;

function resetPlaybackState() {
  isNotificationSoundPlaying = false;
}

function getNotificationAudio() {
  if (typeof window === "undefined" || typeof window.Audio === "undefined") {
    return null;
  }

  if (!notificationAudio) {
    notificationAudio = new window.Audio(NOTIFICATION_SOUND_SRC);
    notificationAudio.preload = "auto";
    notificationAudio.volume = NOTIFICATION_SOUND_VOLUME;
    notificationAudio.addEventListener("ended", resetPlaybackState);
    notificationAudio.addEventListener("pause", () => {
      if (notificationAudio?.ended || notificationAudio?.currentTime === 0) {
        resetPlaybackState();
      }
    });
  }

  return notificationAudio;
}

export async function primeNotificationSound() {
  if (isNotificationSoundPrimed) {
    return true;
  }

  const audio = getNotificationAudio();

  if (!audio) {
    return false;
  }

  try {
    audio.muted = true;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    isNotificationSoundPrimed = true;
    return true;
  } catch {
    audio.muted = false;
    return false;
  }
}

export async function playNotificationSound() {
  const audio = getNotificationAudio();

  if (!audio || isNotificationSoundPlaying) {
    return false;
  }

  try {
    audio.muted = false;
    audio.currentTime = 0;
    isNotificationSoundPlaying = true;
    await audio.play();
    return true;
  } catch {
    resetPlaybackState();
    return false;
  }
}
