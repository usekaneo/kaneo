import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LabelRule, SyncPreview } from "@/fetchers/integration-sync/types";

export function LabelRuleEditor({
  direction,
  rule,
  labels,
  onChange,
}: {
  direction: "outgoing" | "incoming";
  rule: LabelRule;
  labels: SyncPreview["labels"];
  onChange: (rule: LabelRule) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [labelName, setLabelName] = useState("");
  const outgoing = direction === "outgoing";
  const availableLabelIds = new Set(labels.map((label) => label.id));
  const addLabel = () => {
    const name = labelName.trim();
    if (
      rule.mode !== "labels" ||
      !name ||
      name.length > 128 ||
      rule.labels.includes(name) ||
      rule.labels.length >= 50
    )
      return;
    onChange({ ...rule, labels: [...rule.labels, name] });
    setLabelName("");
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">
        {outgoing
          ? t("settings:syncRules.outgoing")
          : t("settings:syncRules.incoming")}
      </legend>
      <p className="text-xs text-muted-foreground">
        {outgoing
          ? t("settings:syncRules.outgoingHint")
          : t("settings:syncRules.incomingHint")}
      </p>
      <Select
        value={rule.mode}
        onValueChange={(mode) => {
          if (mode === "all") onChange({ mode: "all" });
          else if (mode === "labels")
            onChange({ mode: "labels", match: "any", labels: [] });
        }}
      >
        <SelectTrigger
          className="w-full"
          aria-label={
            outgoing
              ? t("settings:syncRules.outgoing")
              : t("settings:syncRules.incoming")
          }
          size="sm"
        >
          <SelectValue>
            {rule.mode === "all"
              ? t("settings:syncRules.all")
              : t("settings:syncRules.filtered")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("settings:syncRules.all")}</SelectItem>
          <SelectItem value="labels">
            {t("settings:syncRules.filtered")}
          </SelectItem>
        </SelectContent>
      </Select>
      {rule.mode === "labels" && (
        <>
          <Select
            value={rule.match}
            onValueChange={(match) => {
              if (match === "any" || match === "all")
                onChange({ ...rule, match });
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={t("settings:syncRules.matchLabels")}
            >
              <SelectValue>
                {rule.match === "any"
                  ? t("settings:syncRules.any")
                  : t("settings:syncRules.every")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("settings:syncRules.any")}</SelectItem>
              <SelectItem value="all">
                {t("settings:syncRules.every")}
              </SelectItem>
            </SelectContent>
          </Select>
          {outgoing ? (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {labels.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("settings:syncRules.noLabels")}
                </p>
              )}
              {rule.labels.some((id) => !availableLabelIds.has(id)) && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...rule,
                      labels: rule.labels.filter((id) =>
                        availableLabelIds.has(id),
                      ),
                    })
                  }
                >
                  {t("settings:syncRules.removeMissingLabels")}
                </Button>
              )}
              {labels.map((label) => (
                <Label
                  key={label.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={rule.labels.includes(label.id)}
                    disabled={
                      rule.labels.length >= 50 &&
                      !rule.labels.includes(label.id)
                    }
                    onCheckedChange={(checked) =>
                      onChange({
                        ...rule,
                        labels: checked
                          ? [...rule.labels, label.id]
                          : rule.labels.filter((item) => item !== label.id),
                      })
                    }
                  />
                  <span className="min-w-0 truncate">{label.name}</span>
                </Label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={id} className="sr-only">
                {t("settings:syncRules.repositoryLabel")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={id}
                  value={labelName}
                  maxLength={128}
                  placeholder={t("settings:syncRules.repositoryLabel")}
                  onChange={(event) => setLabelName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addLabel();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={addLabel}
                  disabled={!labelName.trim() || rule.labels.length >= 50}
                  aria-label={t("settings:syncRules.addLabel")}
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {rule.labels.map((name) => (
                  <Button
                    key={name}
                    size="xs"
                    variant="secondary"
                    onClick={() =>
                      onChange({
                        ...rule,
                        labels: rule.labels.filter((item) => item !== name),
                      })
                    }
                    aria-label={t("settings:syncRules.removeLabel", { name })}
                  >
                    {name}
                    <X aria-hidden="true" />
                  </Button>
                ))}
              </div>
            </div>
          )}
          {rule.labels.length === 0 && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("settings:syncRules.selectLabel")}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
