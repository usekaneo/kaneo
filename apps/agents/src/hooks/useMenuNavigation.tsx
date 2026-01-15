import { useEffect, useRef } from "react";

type UseMenuNavigationProps = {
  menuRef: React.RefObject<HTMLElement | null>;
  direction?: "horizontal" | "vertical"; // Default: horizontal
};

export const useMenuNavigation = ({
  menuRef,
  direction = "horizontal"
}: UseMenuNavigationProps) => {
  const activeElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!menuRef.current) return;

    const focusableElements = Array.from(
      menuRef.current.querySelectorAll(
        'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];

    if (focusableElements.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeElementRef.current) return;

      const currentIndex = focusableElements.indexOf(activeElementRef.current);
      let nextIndex = currentIndex;

      const isHorizontal = direction === "horizontal";
      const forwardKey = isHorizontal ? "ArrowRight" : "ArrowDown";
      const backwardKey = isHorizontal ? "ArrowLeft" : "ArrowUp";

      if (e.key === forwardKey) {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % focusableElements.length;
      } else if (e.key === backwardKey) {
        e.preventDefault();
        nextIndex =
          (currentIndex - 1 + focusableElements.length) %
          focusableElements.length;
      } else {
        return;
      }

      const nextElement = focusableElements[nextIndex];
      activeElementRef.current = nextElement;
      nextElement.focus();
    };

    const addKeyListener = () =>
      document.addEventListener("keydown", handleKeyDown);
    const removeKeyListener = () =>
      document.removeEventListener("keydown", handleKeyDown);

    const handleFocusIn = () => {
      activeElementRef.current = document.activeElement as HTMLElement;
      addKeyListener();
    };

    const handleFocusOut = () => {
      activeElementRef.current = null;
      removeKeyListener();
    };

    menuRef.current.addEventListener("focusin", handleFocusIn);
    menuRef.current.addEventListener("focusout", handleFocusOut);

    return () => {
      menuRef.current?.removeEventListener("focusin", handleFocusIn);
      menuRef.current?.removeEventListener("focusout", handleFocusOut);
      removeKeyListener();
    };
  }, [menuRef, direction]);
};
