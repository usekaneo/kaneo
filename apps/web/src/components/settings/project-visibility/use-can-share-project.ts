import { useEffect, useState } from "react";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function useCanShareProject() {
  const { hasPermission } = useWorkspacePermission();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hasPermission({ project: ["share"] }).then((ok) => {
      if (!cancelled) setCanShare(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [hasPermission]);

  return canShare;
}
