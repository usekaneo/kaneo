import { type TouchEvent, useRef, useState } from "react";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";

// Matches the TouchSensor tolerance and Base UI's long-press threshold.
const MOVE_TOLERANCE = 10;

type Point = { x: number; y: number };

/**
 * Coordinates the touch drag with the context menu's long press. Both start
 * from a held touch; like iPadOS, moving a lifted card means a drag, so it
 * closes the menu, and releasing without moving keeps the menu open.
 */
export function useTouchDragMenu(
  isDragging: boolean,
  onDragTouchStart?: (event: TouchEvent<HTMLDivElement>) => void,
) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const start = useRef<Point | null>(null);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    // Portaled pickers inside the card bubble here through React.
    if (!isOwnDomEvent(event)) return;
    const touch = event.touches[0];
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    onDragTouchStart?.(event);
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!isMenuOpen || !isDragging || !touch || !start.current) return;
    if (
      Math.abs(touch.clientX - start.current.x) > MOVE_TOLERANCE ||
      Math.abs(touch.clientY - start.current.y) > MOVE_TOLERANCE
    )
      setIsMenuOpen(false);
  };

  return { isMenuOpen, setIsMenuOpen, onTouchStart, onTouchMove };
}
