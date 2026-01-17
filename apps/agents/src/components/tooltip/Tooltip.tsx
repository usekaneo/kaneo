import { useTooltip } from "@/providers/TooltipProvider";
import { cn } from "@/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type TooltipProps = {
  children: React.ReactNode;
  className?: string;
  content: string;
  id?: number | string;
};

export const Tooltip = ({ children, className, content, id }: TooltipProps) => {
  const { activeTooltip, showTooltip, hideTooltip } = useTooltip();
  const [positionX, setPositionX] = useState<"center" | "left" | "right">(
    "center"
  );
  const [positionY, setPositionY] = useState<"top" | "bottom">("top");
  const [isHoverAvailable, setIsHoverAvailable] = useState(false); // if hover state exists
  const [isPointer, setIsPointer] = useState(false); // if user is using a pointer device

  const tooltipRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsHoverAvailable(window.matchMedia("(hover: hover)").matches); // check if hover state is available
  }, []);

  const tooltipIdentifier = id ? id + content : content;
  const tooltipId = `tooltip-${id || content.replace(/\s+/g, "-")}`; // used for ARIA

  const isVisible = activeTooltip === tooltipIdentifier;

  // detect collision once the tooltip is visible
  useLayoutEffect(() => {
    const detectCollision = () => {
      const ref = tooltipRef.current;

      if (ref) {
        const tooltipRect = ref.getBoundingClientRect();
        const { top, left, bottom, right } = tooltipRect;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (top <= 0) setPositionY("bottom");
        if (left <= 0) setPositionX("left");
        if (bottom >= viewportHeight) setPositionY("top");
        if (right >= viewportWidth) setPositionX("right");
      }
    };

    if (!isVisible) {
      setPositionX("center");
      setPositionY("top");
    } else {
      detectCollision();
    }
  }, [isVisible]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it's fine, but todo fix
    <div
      aria-describedby={isVisible ? tooltipId : undefined}
      className={cn("relative inline-block", className)}
      onMouseEnter={() =>
        isHoverAvailable && showTooltip(tooltipIdentifier, false)
      }
      onMouseLeave={() => hideTooltip()}
      onPointerDown={(e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
          setIsPointer(true);
        }
      }}
      onPointerUp={() => setIsPointer(false)}
      onFocus={() => {
        // only allow tooltips when hover state is available
        if (isHoverAvailable) {
          isPointer // if user clicks with a mouse, do not auto-populate tooltip
            ? showTooltip(tooltipIdentifier, false)
            : showTooltip(tooltipIdentifier, true);
        } else {
          hideTooltip();
        }
      }}
      onBlur={() => hideTooltip()}
    >
      {children}
      {isVisible && (
        <span
          aria-hidden={!isVisible}
          className={cn(
            "bg-ob-base-1000 text-ob-inverted absolute w-max rounded-md px-2 py-1 text-sm shadow before:absolute before:top-0 before:left-0 before:size-full before:scale-[1.5] before:bg-transparent",
            {
              "left-0 translate-x-0": positionX === "left",
              "right-0 translate-x-0": positionX === "right",
              "left-1/2 -translate-x-1/2": positionX === "center",
              "-bottom-7": positionY === "bottom",
              "-top-7": positionY === "top"
            }
          )}
          id={tooltipId}
          ref={tooltipRef}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </div>
  );
};
