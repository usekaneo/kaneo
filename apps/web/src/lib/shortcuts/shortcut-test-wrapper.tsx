import type { ReactNode } from "react";
import { ShortcutListener } from "./shortcut-listener";

export function ShortcutTestWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <ShortcutListener />
      {children}
    </>
  );
}
