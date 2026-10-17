import { useState } from "react";

export function useToolbarPresence(selectedCount: number) {
  const [mounted, setMounted] = useState(selectedCount > 0);
  const [lastCount, setLastCount] = useState(selectedCount);

  if (selectedCount > 0 && !mounted) setMounted(true);
  if (selectedCount > 0 && selectedCount !== lastCount) {
    setLastCount(selectedCount);
  }

  return {
    mounted,
    hidden: selectedCount === 0,
    displayCount: selectedCount > 0 ? selectedCount : lastCount,
  };
}
