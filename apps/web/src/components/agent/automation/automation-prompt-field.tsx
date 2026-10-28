import { AtSign } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { AgentModelMenu } from "../agent-model-menu";
import {
  AgentPromptEditor,
  type AgentPromptEditorHandle,
} from "../mention/agent-prompt-editor";
import { AutomationFieldError } from "./automation-field-error";

type AutomationPromptFieldProps = {
  workspaceId: string;
  projectId: string | null;
  value: string;
  onValueChange: (value: string) => void;
  models: { id: string; label: string }[];
  model: string | null;
  onModelChange: (model: string) => void;
  error: string | undefined;
};

export function AutomationPromptField({
  workspaceId,
  projectId,
  value,
  onValueChange,
  models,
  model,
  onModelChange,
  error,
}: AutomationPromptFieldProps) {
  const { t } = useTranslation();
  const editorRef = useRef<AgentPromptEditorHandle>(null);

  return (
    <div className="flex flex-col gap-2">
      <Label id="automation-prompt-label">
        {t("agent:automations.form.prompt")}
      </Label>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs/5 focus-within:border-ring/60",
          error && "border-destructive/50",
        )}
      >
        <AgentPromptEditor
          editorRef={editorRef}
          labelledBy="automation-prompt-label"
          value={value}
          onValueChange={onValueChange}
          onSubmit={() => {}}
          onPasteFiles={() => {}}
          placeholder={t("agent:automations.form.promptPlaceholder")}
          mentionScope={{ workspaceId, projectId: projectId ?? undefined }}
          menuPlacement="below"
          multiline
          className="min-h-48 max-h-[28rem] text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={t("agent:automations.form.mention")}
            onClick={() => editorRef.current?.startMention()}
          >
            <AtSign aria-hidden="true" />
          </Button>
          {models.length > 1 && (
            <AgentModelMenu
              models={models}
              value={model}
              onValueChange={onModelChange}
            />
          )}
        </div>
      </div>
      <AutomationFieldError id="automation-prompt-error" error={error} />
    </div>
  );
}
