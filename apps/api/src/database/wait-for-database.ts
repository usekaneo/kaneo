type WaitForDatabaseOptions = {
  query: () => Promise<unknown>;
  sleep?: (delayMs: number) => Promise<void>;
  maxAttempts?: number;
  retryDelayMs?: number;
};

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function waitForDatabase({
  query,
  sleep = defaultSleep,
  maxAttempts = 30,
  retryDelayMs = 1_000,
}: WaitForDatabaseOptions): Promise<void> {
  if (maxAttempts < 1) {
    throw new RangeError(`maxAttempts must be at least 1, got ${maxAttempts}`);
  }

  if (retryDelayMs < 0) {
    throw new RangeError(
      `retryDelayMs must be non-negative, got ${retryDelayMs}`,
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await query();
      return;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      await sleep(retryDelayMs);
    }
  }
}
