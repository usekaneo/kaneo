import { useEffect, useRef } from "react";

export function useFocusHeadingOnChange<T extends HTMLElement>(key: string) {
  const containerRef = useRef<T>(null);
  const previousKey = useRef(key);

  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;

    const heading = containerRef.current?.querySelector<HTMLElement>("h1");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
    }
    heading.focus();
  }, [key]);

  return containerRef;
}
