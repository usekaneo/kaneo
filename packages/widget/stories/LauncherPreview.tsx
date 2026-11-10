import { useEffect, useRef } from "react";
import { createLauncher } from "../src/core/launcher.js";
import { removeStyles } from "../src/core/style.js";

export interface LauncherPreviewProps {
  placement: "left" | "right";
  label: string;
  greeting: string;
  unread: number;
  open: boolean;
  backgroundColor: string;
  foregroundColor: string;
}

export function LauncherPreview(props: LauncherPreviewProps) {
  const root = useRef<HTMLDivElement>(null);
  const {
    placement,
    label,
    greeting,
    unread,
    open,
    backgroundColor,
    foregroundColor,
  } = props;

  useEffect(() => {
    let isOpen = open;
    const launcher = createLauncher({
      root: root.current!,
      placement,
      onClick: () => {
        isOpen = !isOpen;
        launcher.setOpen(isOpen);
      },
    });
    launcher.setLabel(label);
    launcher.setGreeting(greeting);
    launcher.setUnread(unread);
    launcher.setOpen(open);
    launcher.setColors({ backgroundColor, foregroundColor });
    launcher.reveal();
    return () => {
      launcher.remove();
      removeStyles();
    };
  }, [
    placement,
    label,
    greeting,
    unread,
    open,
    backgroundColor,
    foregroundColor,
  ]);

  return (
    <main className="widget-story">
      <h1>Launcher</h1>
      <p>
        Use Controls to change the real launcher. Click it to preview the open
        state, which hides the launcher. Reset the story to show it again.
      </p>
      <div className="widget-story-launcher-stage" ref={root} />
    </main>
  );
}
