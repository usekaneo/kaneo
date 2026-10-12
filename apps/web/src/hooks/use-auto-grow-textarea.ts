import { useLayoutEffect, useRef } from "react";

// Grows a one-row textarea to fit its content so long titles wrap instead of
// scrolling sideways out of view, which on phones hid most of the title.
export function useAutoGrowTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    const fit = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    // Re-fit when the width changes (rotation, resizing a sheet).
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === width) return;
      width = textarea.clientWidth;
      fit();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [value]);

  return ref;
}
