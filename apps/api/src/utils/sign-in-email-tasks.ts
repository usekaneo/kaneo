const pending = new Set<Promise<void>>();

// Queue eligibility checks as well as SMTP so neither determines response time.
export function queueSignInEmail(deliver: () => Promise<void>): void {
  const task = Promise.resolve()
    .then(deliver)
    .catch(() => {
      // Provider errors can contain addresses, tokens, or SMTP credentials.
      console.error("Sign-in email delivery failed");
    })
    .finally(() => pending.delete(task));
  pending.add(task);
}

// Bound shutdown waiting when a mail provider is unavailable.
export async function drainSignInEmails(timeoutMs = 10_000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        while (pending.size > 0) await Promise.all([...pending]);
        return true;
      })(),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
