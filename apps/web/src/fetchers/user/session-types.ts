import type { getUserSessions } from "./get-user-sessions";

export type ActiveSession = Awaited<
  ReturnType<typeof getUserSessions>
>["sessions"][number];
