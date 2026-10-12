import { useEffect, useRef, useState } from "react";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import type { UpdateNotificationPreferencesRequest } from "@/fetchers/notification-preferences/update-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import {
  type EventPreferences,
  type EventSwitchKey,
  toEventPreferences,
} from "./event-preferences";
import { getValidLeadTimeMinutes, type LeadTime } from "./lead-time";

export const LEAD_TIME_SAVE_DELAY_MS = 600;

export function useEventPreferencesAutosave(
  preferences: NotificationPreferences,
) {
  const [state, setState] = useState<EventPreferences>(() =>
    toEventPreferences(preferences),
  );
  const { mutateAsync } = useUpdateNotificationPreferences({ silent: true });
  const timeoutRef = useRef<number | undefined>(undefined);
  const pendingMinutesRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
      const minutes = pendingMinutesRef.current;
      pendingMinutesRef.current = null;
      if (minutes !== null) {
        mutateAsync({ dueDateReminderLeadTimeMinutes: minutes }).catch(
          () => undefined,
        );
      }
    },
    [mutateAsync],
  );

  const saveLeadTime = () => {
    const minutes = pendingMinutesRef.current;
    pendingMinutesRef.current = null;
    if (minutes === null) return;
    mutateAsync({ dueDateReminderLeadTimeMinutes: minutes }).catch(
      () => undefined,
    );
  };

  const setSwitch = (key: EventSwitchKey, checked: boolean) => {
    setState((current) => ({ ...current, [key]: checked }));
    if (key === "dueDateReminderEnabled" && !checked) {
      window.clearTimeout(timeoutRef.current);
      pendingMinutesRef.current = null;
    }
    const payload: UpdateNotificationPreferencesRequest = {};
    payload[key] = checked;
    mutateAsync(payload).catch(() => {
      setState((current) => ({ ...current, [key]: !checked }));
    });
  };

  const setLeadTime = (leadTime: LeadTime) => {
    setState((current) => ({ ...current, leadTime }));
    window.clearTimeout(timeoutRef.current);
    pendingMinutesRef.current = state.dueDateReminderEnabled
      ? getValidLeadTimeMinutes(leadTime)
      : null;
    if (pendingMinutesRef.current === null) return;
    timeoutRef.current = window.setTimeout(
      saveLeadTime,
      LEAD_TIME_SAVE_DELAY_MS,
    );
  };

  return { state, setSwitch, setLeadTime };
}
