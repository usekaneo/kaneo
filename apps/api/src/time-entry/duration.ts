import { HTTPException } from "hono/http-exception";

const MAX_DURATION_SECONDS = 2_147_483_647;

export function resolveDuration(startTime: Date, endTime?: Date) {
  if (!endTime) {
    return null;
  }

  if (startTime.getTime() > endTime.getTime()) {
    throw new HTTPException(400, {
      message:
        "Start time cannot be after end time. Please adjust the time range.",
    });
  }

  const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  if (duration > MAX_DURATION_SECONDS) {
    throw new HTTPException(400, {
      message: "The time range is too long to record.",
    });
  }

  return duration;
}
