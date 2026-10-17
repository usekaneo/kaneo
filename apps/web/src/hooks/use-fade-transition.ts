import { useReducedMotion } from "framer-motion";

export function useFadeTransition() {
  const reduceMotion = useReducedMotion();
  return {
    initial: { opacity: 0, y: reduceMotion ? 0 : 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduceMotion ? 0 : -20 },
  };
}
