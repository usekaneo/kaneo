export type TaskRecurrence = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  timeZone: string;
  // 0 for Sunday to 6 for Saturday; weekly rules only.
  weekdays?: number[];
};
