import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { Button } from "@/components/ui/button";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { useAgentPanelStore } from "@/store/agent-panel";

export function AgentButton() {
  const { t } = useTranslation();
  const open = useAgentPanelStore((state) => state.open);
  const toggle = useAgentPanelStore((state) => state.toggle);

  useShortcut("toggleAgent", toggle);

  return (
    <Button
      size="xs"
      variant={open ? "secondary" : "default"}
      className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
      aria-pressed={open}
      onClick={toggle}
    >
      <Sparkles aria-hidden="true" className="size-3.5" />
      {t("agent:title")}
      <ShortcutKeys
        id="toggleAgent"
        className="hidden opacity-60 sm:inline-flex"
      />
    </Button>
  );
}
