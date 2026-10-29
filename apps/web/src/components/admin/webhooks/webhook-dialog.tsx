import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { AUDIT_LOG_CATEGORIES } from "@/components/admin/audit-log/audit-log-categories";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createAdminWebhook } from "@/fetchers/admin/create-admin-webhook";
import { updateAdminWebhook } from "@/fetchers/admin/update-admin-webhook";
import type {
  AdminWebhook,
  AdminWebhookValues,
} from "@/fetchers/admin/webhook-types";
import useAdminWebhookMutation from "@/hooks/mutations/admin/use-admin-webhook-mutation";

type Props = {
  webhook: AdminWebhook | null;
  onClose: () => void;
  onSecret: (secret: string) => void;
};
export function WebhookDialog({ webhook, onClose, onSecret }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<AdminWebhookValues>(
    webhook ?? { url: "", categories: [], enabled: true },
  );
  const create = useAdminWebhookMutation(createAdminWebhook);
  const update = useAdminWebhookMutation(updateAdminWebhook);
  const pending = create.isPending || update.isPending;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.categories.length) return;
    try {
      if (webhook)
        await update.mutateAsync({ ...values, webhookId: webhook.id });
      else {
        const result = await create.mutateAsync(values);
        onSecret(result.secret);
        create.reset();
      }
      onClose();
    } catch {
      return;
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form className="contents" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {webhook
                ? t("settings:adminWebhooks.edit")
                : t("settings:adminWebhooks.add")}
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <div className="space-y-5">
              <Field>
                <FieldLabel htmlFor="webhook-url">
                  {t("settings:adminWebhooks.url")}
                </FieldLabel>
                <Input
                  id="webhook-url"
                  type="url"
                  required
                  maxLength={2048}
                  autoComplete="off"
                  placeholder="https://"
                  value={values.url}
                  disabled={pending}
                  onChange={(e) =>
                    setValues({ ...values, url: e.target.value })
                  }
                />
              </Field>
              <fieldset className="space-y-3" disabled={pending}>
                <legend className="mb-3 text-sm font-medium">
                  {t("settings:adminWebhooks.categories")}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {AUDIT_LOG_CATEGORIES.filter(
                    (category) => category.value !== "",
                  ).map(({ value, labelKey }) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={values.categories.includes(value)}
                        disabled={pending}
                        onCheckedChange={(checked) =>
                          setValues({
                            ...values,
                            categories: checked
                              ? [...values.categories, value]
                              : values.categories.filter(
                                  (category) => category !== value,
                                ),
                          })
                        }
                      />
                      {t(labelKey)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center justify-between gap-4 text-sm font-medium">
                {t("settings:adminWebhooks.enabled")}
                <Switch
                  checked={values.enabled}
                  disabled={pending}
                  onCheckedChange={(enabled) =>
                    setValues({ ...values, enabled })
                  }
                />
              </label>
            </div>
          </DialogPanel>
          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" />}
              disabled={pending}
            >
              {t("common:actions.cancel")}
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || !values.categories.length || !values.url}
            >
              {webhook
                ? t("settings:adminWebhooks.save")
                : t("settings:adminWebhooks.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
