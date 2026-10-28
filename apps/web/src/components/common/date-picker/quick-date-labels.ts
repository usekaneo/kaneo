import { formatDate } from "@/lib/format";
import type { QuickDateId } from "./quick-dates";

export const QUICK_DATE_LABEL_KEYS: Record<QuickDateId, string> = {
  today: "tasks:due.today",
  tomorrow: "tasks:due.tomorrow",
  weekend: "tasks:datePicker.thisWeekend",
  "next-week": "tasks:datePicker.nextWeek",
};

export const formatPickerDay = (date: Date) =>
  formatDate(date, { weekday: "short", month: "short", day: "numeric" });
