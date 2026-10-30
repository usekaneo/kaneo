import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { Kbd } from "@/components/ui/kbd";

type TextFieldEditorProps = {
  field: CustomFieldDefinition;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

export function TextFieldEditor({
  field,
  draft,
  onDraftChange,
  onSubmit,
}: TextFieldEditorProps) {
  const { t } = useTranslation();
  const isNumber = field.type === "number";

  return (
    <div className="w-64">
      <input
        autoFocus
        type={isNumber ? "number" : "text"}
        inputMode={isNumber ? "decimal" : undefined}
        value={draft}
        aria-label={field.name}
        placeholder={field.defaultValue || field.name}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSubmit();
        }}
        className="h-10 w-full bg-transparent px-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex items-center justify-between gap-2 border-border/80 border-t px-3 py-2 text-muted-foreground text-xs">
        <span>{field.required ? t("tasks:customFields.required") : null}</span>
        <span className="flex items-center gap-1">
          <Kbd>{t("tasks:customFields.enterKey")}</Kbd>
          {t("tasks:customFields.toSave")}
        </span>
      </div>
    </div>
  );
}
