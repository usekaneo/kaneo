import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAdminModelCatalog } from "@/hooks/queries/admin/use-admin-model-catalog";
import type { ModelChoice } from "./types";

type ModelCatalogPickerProps = {
  provider: string;
  selectedIds: string[];
  onChange: (model: ModelChoice | null) => void;
};

export function ModelCatalogPicker({
  provider,
  selectedIds,
  onChange,
}: ModelCatalogPickerProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAdminModelCatalog(provider);
  const [chosen, setChosen] = useState<ModelChoice | null>(null);
  const [manual, setManual] = useState(false);
  const [customId, setCustomId] = useState("");
  const showManual = manual || isError || data?.supported === false;
  const items = (data?.models ?? []).filter(
    (model) => !selectedIds.includes(model.id),
  );

  function choose(model: ModelChoice | null) {
    const valid =
      model &&
      !selectedIds.includes(model.id) &&
      /^[^\s,]{1,200}$/.test(model.id);
    onChange(valid ? model : null);
  }

  function enterId(value: string) {
    setCustomId(value);
    const raw = value.trim();
    const id = raw.startsWith(`${provider}:`) ? raw : `${provider}:${raw}`;
    choose(raw ? { id, label: raw } : null);
  }

  return (
    <div className="space-y-2">
      <Field>
        <FieldLabel>
          {showManual
            ? t("settings:adminAgent.modelId")
            : t("settings:adminAgent.model")}
        </FieldLabel>
        {showManual ? (
          <Input
            type="text"
            value={customId}
            autoComplete="off"
            spellCheck={false}
            placeholder={`${provider}:model-id`}
            onChange={(event) => enterId(event.target.value)}
          />
        ) : (
          <Combobox
            items={items}
            value={chosen}
            onValueChange={(model) => {
              setChosen(model);
              choose(model);
            }}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.id}
            disabled={isLoading}
          >
            <ComboboxInput
              placeholder={
                isLoading
                  ? t("settings:adminAgent.loadingModels")
                  : t("settings:adminAgent.searchModels")
              }
            />
            <ComboboxPopup>
              <ComboboxEmpty>
                {t("settings:adminAgent.noMatches")}
              </ComboboxEmpty>
              <ComboboxList>
                {(item: ModelChoice) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </Combobox>
        )}
      </Field>
      {isError ? (
        <div
          className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
          role="alert"
        >
          <span>{t("settings:adminAgent.catalogError")}</span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => refetch()}
          >
            {t("settings:adminUsers.retry")}
          </Button>
        </div>
      ) : null}
      {data?.supported && !isError ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="-ms-2 text-muted-foreground"
          onClick={() => {
            setManual(!manual);
            setChosen(null);
            setCustomId("");
            onChange(null);
          }}
        >
          {manual
            ? t("settings:adminAgent.browseModels")
            : t("settings:adminAgent.enterModelId")}
        </Button>
      ) : null}
    </div>
  );
}
