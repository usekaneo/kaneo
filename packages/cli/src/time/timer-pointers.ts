export type TimerPointer = {
  readonly entryId: string;
  readonly taskId: string;
};

export type TimerPointers = Readonly<Record<string, TimerPointer>>;

function isPointer(value: unknown): value is TimerPointer {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.entryId === "string" && typeof record.taskId === "string"
  );
}

export function parseTimerPointers(text: string): TimerPointers {
  try {
    const parsed: unknown = JSON.parse(text);
    const timers =
      parsed && typeof parsed === "object"
        ? (parsed as { timers?: unknown }).timers
        : undefined;
    if (!timers || typeof timers !== "object") return {};
    const pointers: Record<string, TimerPointer> = {};
    for (const [apiUrl, value] of Object.entries(timers)) {
      if (isPointer(value)) {
        pointers[apiUrl] = { entryId: value.entryId, taskId: value.taskId };
      }
    }
    return pointers;
  } catch {
    return {};
  }
}

export function serializeTimerPointers(pointers: TimerPointers): string {
  return `${JSON.stringify({ version: 1, timers: pointers }, null, 2)}\n`;
}

export function withTimerPointer(
  pointers: TimerPointers,
  apiUrl: string,
  pointer: TimerPointer | null,
): TimerPointers {
  const { [apiUrl]: _previous, ...rest } = pointers;
  return pointer ? { ...rest, [apiUrl]: pointer } : rest;
}
