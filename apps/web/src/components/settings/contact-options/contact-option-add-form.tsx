import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/components/project/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AddedContactOptions } from "@/fetchers/contact-options";
import { toast } from "@/lib/toast";
import type { ContactOptionCopy } from "./contact-option-copy";

type ContactOptionAddFormProps = {
  copy: ContactOptionCopy;
  pending: boolean;
  onAdd: (labels: string[]) => Promise<AddedContactOptions>;
};

const SKIPPED_SHOWN = 8;
const MAX_LABEL_LENGTH = 120;

// One name at a time, or many pasted one per line.
export function ContactOptionAddForm({
  copy,
  pending,
  onAdd,
}: ContactOptionAddFormProps) {
  const { t } = useTranslation();
  const ids = { one: useId(), many: useId() };
  const [one, setOne] = useState("");
  const [many, setMany] = useState("");
  const [result, setResult] = useState<AddedContactOptions | null>(null);

  const add = async (labels: string[], clear: () => void) => {
    setResult(null);
    try {
      const added = await onAdd(labels);
      clear();
      setResult(added);
    } catch (error) {
      toast.error(
        errorMessage(error, t("settings:workspaceContacts.addError")),
      );
    }
  };

  const submitOne = (event: FormEvent) => {
    event.preventDefault();
    if (one.trim() && !pending) void add([one], () => setOne(""));
  };
  const submitMany = (event: FormEvent) => {
    event.preventDefault();
    const lines = many
      .split(/\r?\n/)
      .map((line) => line.trim().slice(0, MAX_LABEL_LENGTH))
      .filter(Boolean);
    if (lines.length > 0 && !pending) void add(lines, () => setMany(""));
  };

  return (
    <div className="space-y-4 border-border border-t px-4 py-4">
      <form className="space-y-2" onSubmit={submitOne}>
        <Label htmlFor={ids.one}>{copy.addLabel}</Label>
        <div className="flex gap-2">
          <Input
            id={ids.one}
            value={one}
            maxLength={120}
            placeholder={copy.addPlaceholder}
            onChange={(event) => setOne(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pending || one.trim() === ""}
          >
            {t("settings:workspaceContacts.add")}
          </Button>
        </div>
      </form>
      <form className="space-y-2" onSubmit={submitMany}>
        <Label htmlFor={ids.many}>{copy.bulkLabel}</Label>
        <Textarea
          id={ids.many}
          value={many}
          rows={4}
          placeholder={copy.bulkPlaceholder}
          aria-describedby={`${ids.many}-hint`}
          onChange={(event) => setMany(event.target.value)}
        />
        <p id={`${ids.many}-hint`} className="text-muted-foreground text-xs">
          {copy.bulkHint}
        </p>
        <Button
          type="submit"
          variant="outline"
          disabled={pending || many.trim() === ""}
        >
          {t("settings:workspaceContacts.addAll")}
        </Button>
      </form>
      <div aria-live="polite" className="text-sm">
        {result ? (
          <>
            <p>
              {t("settings:workspaceContacts.addedCount", {
                count: result.created.length,
              })}
              {result.skipped.length > 0
                ? ` · ${t("settings:workspaceContacts.skippedCount", { count: result.skipped.length })}`
                : null}
            </p>
            {result.skipped.length > 0 ? (
              <p className="text-muted-foreground text-xs">
                {result.skipped.slice(0, SKIPPED_SHOWN).join(", ")}
                {result.skipped.length > SKIPPED_SHOWN ? "…" : null}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
