"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type FadeInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  threshold?: number;
};

export function FadeIn({
  children,
  className,
  delay = 0,
  distance = 20,
  threshold = 0.15,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  // "ssr" = no JS yet (fully visible for crawlers), "hidden" = JS loaded but
  // not in view, "visible" = animated in
  const [phase, setPhase] = useState<"ssr" | "hidden" | "visible">("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // After hydration: hide first (no transition), then set up the observer.
    // The 50ms gap ensures the browser commits the hidden paint before we
    // start observing; otherwise elements already in view skip the animation.
    setPhase("hidden");

    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setPhase("visible");
            observer.disconnect();
          }
        },
        { threshold },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, 50);

    return () => clearTimeout(timer);
  }, [threshold]);

  const isHidden = phase === "hidden";

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={
        phase === "ssr"
          ? // SSR / no-JS: fully visible, so crawlers see normal content
            undefined
          : {
              opacity: isHidden ? 0 : 1,
              filter: isHidden ? "blur(6px)" : "blur(0px)",
              transform: isHidden
                ? `translateY(${distance}px)`
                : "translateY(0px)",
              transition: isHidden
                ? "none"
                : `opacity 0.65s ease ${delay}ms, filter 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
              willChange: isHidden ? "opacity, filter, transform" : "auto",
            }
      }
    >
      {children}
    </div>
  );
}
