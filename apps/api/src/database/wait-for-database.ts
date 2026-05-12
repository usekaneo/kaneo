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
