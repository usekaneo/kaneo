import { useCallback, useEffect, useEffectEvent, useState } from "react";

type CheckState<Result> = {
  key: string;
  result?: Result;
  error?: unknown;
};

export function useDebouncedCheck<Result>(
  key: string | null,
  run: () => Promise<Result>,
  delay = 400,
) {
  const [state, setState] = useState<CheckState<Result> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const runCheck = useEffectEvent(run);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timeout = window.setTimeout(
      async () => {
        try {
          const result = await runCheck();
          if (!cancelled) setState({ key, result });
        } catch (error) {
          if (!cancelled) setState({ key, error });
        }
      },
      attempt === 0 ? delay : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [key, delay, attempt]);

  const current = key !== null && state?.key === key ? state : null;
  const recheck = useCallback(() => {
    setState(null);
    setAttempt((value) => value + 1);
  }, []);

  return {
    checking: key !== null && current === null,
    result: current?.result,
    error: current?.error,
    recheck,
  };
}
