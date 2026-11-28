import { HTTPException } from "hono/http-exception";
import { getDatabasePool } from "../../database";

const MAX_ACTIVE = 2;
const MAX_WAITING = 32;
const WAIT_TIMEOUT_MS = 2_000;
let active = 0;
const waiting: Array<() => void> = [];

function saturated(): HTTPException {
  return new HTTPException(503, {
    message: "Tangled processing is busy; retry delivery later",
  });
}

async function acquire(): Promise<void> {
  const limit = Math.min(MAX_ACTIVE, (getDatabasePool().options.max ?? 10) - 1);
  if (active < limit) {
    active++;
    return;
  }
  if (waiting.length >= MAX_WAITING) throw saturated();
  await new Promise<void>((resolve, reject) => {
    const admit = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      const index = waiting.indexOf(admit);
      if (index !== -1) waiting.splice(index, 1);
      reject(saturated());
    }, WAIT_TIMEOUT_MS);
    waiting.push(admit);
  });
}

export async function withTangledAdmission<T>(
  work: () => Promise<T>,
): Promise<T> {
  await acquire();
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
