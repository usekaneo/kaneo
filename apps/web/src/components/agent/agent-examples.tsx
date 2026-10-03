import { FileText, Inbox, ListTree, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const groups: Array<{
  key: "plan" | "triage" | "report";
  icon: LucideIcon;
}> = [
  { key: "plan", icon: ListTree },
  { key: "triage", icon: Inbox },
  { key: "report", icon: FileText },
];
const exampleKeys = ["first", "second"] as const;

type AgentExamplesProps = {
  onPick: (prompt: string) => void;
};

export function AgentExamples({ onPick }: AgentExamplesProps) {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2 border-border/80 border-b pb-2.5">
        <h2 className="font-semibold text-[15px] text-foreground">
          {t("agent:home.examplesTitle")}
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {t("agent:home.examplesHint")}
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-3 sm:gap-4">
        {groups.map(({ key, icon: Icon }) => (
          <div key={key} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Icon aria-hidden="true" className="size-4" />
                {t(`agent:home.examples.${key}.title`)}
              </h3>
              <p className="text-[13px] text-muted-foreground leading-snug">
                {t(`agent:home.examples.${key}.description`)}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {exampleKeys.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-[10px] bg-muted/70 px-3 py-2.5 text-left text-[13px] text-foreground leading-snug transition-colors hover:bg-muted"
                  onClick={() =>
                    onPick(t(`agent:home.examples.${key}.${example}`))
                  }
                >
                  “{t(`agent:home.examples.${key}.${example}`)}”
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
