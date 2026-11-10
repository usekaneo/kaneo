import { useEffect, useRef, useState } from "react";

const idle = { pending: false, error: "" };

/** Independent control groups keep pending state and failures with their own item. */
export function useAction() {
  const [states, setStates] = useState(new Map<string, typeof idle>());
  const busy = useRef(new Set<string>());
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      busy.current.clear();
    },
    [],
  );
  return {
    ...(states.get("") ?? idle),
    forKey: (key: string) => states.get(key) ?? idle,
    async run(action: () => Promise<unknown>, key = "") {
      if (busy.current.has(key)) return;
      busy.current.add(key);
      const token = generation.current;
      setStates((current) =>
        new Map(current).set(key, { pending: true, error: "" }),
      );
      let error = "";
      try {
        await action();
      } catch {
        error = "That action failed. Please try again.";
      } finally {
        if (token === generation.current) {
          busy.current.delete(key);
          setStates((current) =>
            new Map(current).set(key, { pending: false, error }),
          );
        }
      }
    },
  };
}
