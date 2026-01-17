import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import useClickOutside from "@/hooks/useClickOutside";
import { XIcon } from "@phosphor-icons/react";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
  className?: string;
  children: React.ReactNode;
  clickOutsideToClose?: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export const Modal = ({
  className,
  children,
  clickOutsideToClose = false,
  isOpen,
  onClose
}: ModalProps) => {
  const modalRef = clickOutsideToClose
    ? // biome-ignore lint/correctness/useHookAtTopLevel: todo
      useClickOutside(onClose)
    : // biome-ignore lint/correctness/useHookAtTopLevel: todo
      useRef<HTMLDivElement>(null);

  // Stop site overflow when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Tab focus
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) firstElement.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          // Shift + Tab moves focus backward
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab moves focus forward
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, modalRef.current]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 z-50 flex h-screen w-full items-center justify-center bg-transparent p-6">
      <div className="fade fixed top-0 left-0 h-full w-full bg-black/5 backdrop-blur-[2px]" />

      <Card
        className={cn("reveal reveal-sm relative z-50 max-w-md", className)}
        ref={modalRef}
        tabIndex={-1}
      >
        {children}

        <Button
          aria-label="Close Modal"
          shape="square"
          className="absolute top-2 right-2"
          onClick={onClose}
          variant="ghost"
        >
          <XIcon size={16} />
        </Button>
      </Card>
    </div>
  );
};
