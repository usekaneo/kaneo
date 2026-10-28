import {
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function readStored<T>(
  key: string | null,
  parse: (raw: unknown) => T,
  fallback: T,
): T {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : parse(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function useStoredState<T>(
  key: string | null,
  parse: (raw: unknown) => T,
  fallback: T,
) {
  const [state, setState] = useState(() => ({
    key,
    value: readStored(key, parse, fallback),
  }));
  const current =
    state.key === key
      ? state
      : { key, value: readStored(key, parse, fallback) };
  if (current !== state) setState(current);

  const latestKey = useRef(key);
  latestKey.current = key;

  useEffect(() => {
    if (!current.key || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(current.key, JSON.stringify(current.value));
    } catch {}
  }, [current.key, current.value]);

  const setValue = useCallback((update: SetStateAction<T>) => {
    setState((prev) => ({
      key: latestKey.current,
      value:
        typeof update === "function"
          ? (update as (previous: T) => T)(prev.value)
          : update,
    }));
  }, []);

  return [current.value, setValue] as const;
}
