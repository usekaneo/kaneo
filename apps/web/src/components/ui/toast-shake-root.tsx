import { Toast } from "@base-ui/react/toast";
import { useEffect, useRef } from "react";

const SHAKE: Keyframe[] = [
  { translate: "0 0" },
  { translate: "-5px 0" },
  { translate: "5px 0" },
  { translate: "-3px 0" },
  { translate: "3px 0" },
  { translate: "-1px 0" },
  { translate: "0 0" },
];

const PULSE: Keyframe[] = [{ opacity: 1 }, { opacity: 0.64 }, { opacity: 1 }];

export function ToastShakeRoot({
  shakeKey,
  ...props
}: Toast.Root.Props & { shakeKey: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(shakeKey);

  useEffect(() => {
    if (previous.current === shakeKey) return;
    previous.current = shakeKey;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    ref.current?.animate(reduceMotion ? PULSE : SHAKE, {
      duration: reduceMotion ? 200 : 320,
      easing: reduceMotion ? "ease" : "linear",
    });
  }, [shakeKey]);

  return <Toast.Root ref={ref} {...props} />;
}
