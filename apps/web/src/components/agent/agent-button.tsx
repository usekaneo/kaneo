import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAgentPanelStore } from "@/store/agent-panel";

export function AgentButton() {
  const { t } = useTranslation();
  const open = useAgentPanelStore((state) => state.open);
  const toggle = useAgentPanelStore((state) => state.toggle);

  useRegisterShortcuts({
    modifierShortcuts: {
      [shortcuts.agent.prefix]: {
        [shortcuts.agent.toggle]: toggle,
      },
    },
  });

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
      <kbd className="hidden font-mono text-[10px] opacity-60 sm:inline">
        {shortcuts.agent.prefix}
        {shortcuts.agent.toggle.toUpperCase()}
      </kbd>
    </Button>
  );
}
