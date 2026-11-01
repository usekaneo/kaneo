import { useTranslation } from "react-i18next";

const suggestionKeys = ["risk", "workload", "statusUpdate"] as const;

type AgentSuggestionsProps = {
  onPick: (prompt: string) => void;
};

export function AgentSuggestions({ onPick }: AgentSuggestionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {suggestionKeys.map((key) => (
        <button
          key={key}
          type="button"
          className="h-6.5 rounded-full border border-border/80 px-2.5 font-medium text-foreground/80 text-xs transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => onPick(t(`agent:suggestions.${key}`))}
        >
          {t(`agent:suggestions.${key}`)}
        </button>
      ))}
    </div>
  );
}
