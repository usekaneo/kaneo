import type { SettingsSchema } from "@kaneo/plugin-sdk/server";

export const settings = {
  doneStatus: {
    type: "text",
    label: "Status that counts as done",
    default: "done",
  },
} as const satisfies SettingsSchema;
