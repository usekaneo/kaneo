import type { Notification } from "@/types/notification";

let isNotificationSpeechPrimed = false;
let isNotificationSpeechActive = false;

function getSpeechSynthesis() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function resetSpeechState() {
  isNotificationSpeechActive = false;
}

export async function primeNotificationSound() {
  const speech = getSpeechSynthesis();

  if (!speech) {
    return false;
  }

  // Loading voices after a real user interaction gives speech synthesis
  // a better chance of succeeding across browsers.
  speech.getVoices();
  isNotificationSpeechPrimed = true;
  return true;
}

export async function playNotificationSound() {
  return playNotificationAnnouncement([]);
}

function getNotificationAnnouncement(notification: Notification) {
  switch (notification.type) {
    case "task_assignee_changed":
    case "task_created":
      return "New task alert";
    case "task_comment_created":
      return "New comment alert";
    case "task_status_changed":
      return "Task update alert";
    case "workspace_created":
      return "New workspace alert";
    case "time_entry_created":
      return "New time entry alert";
    default:
      return "New notification";
  }
}

export async function playNotificationAnnouncement(
  notifications: Notification[],
) {
  const speech = getSpeechSynthesis();

  if (!speech || isNotificationSpeechActive || !isNotificationSpeechPrimed) {
    return false;
  }

  try {
    speech.cancel();

    const announcement =
      notifications.length > 1
        ? `You have ${notifications.length} new notifications`
        : notifications.length === 1
          ? getNotificationAnnouncement(notifications[0])
          : "New notification";

    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = resetSpeechState;
    utterance.onerror = resetSpeechState;

    isNotificationSpeechActive = true;
    speech.speak(utterance);
    return true;
  } catch {
    resetSpeechState();
    return false;
  }
}
