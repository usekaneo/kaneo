import { hasShellEntered } from "./shell-entered";
import { ShellFrame } from "./shell-frame";

function isShellPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return path === "/dashboard" || path.startsWith("/dashboard/workspace/");
}

export function BootFrame() {
  if (hasShellEntered() || !isShellPath(window.location.pathname)) return null;
  return <ShellFrame />;
}
