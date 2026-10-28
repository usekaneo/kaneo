import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useId, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  type ApiKeyExpiration,
  DEFAULT_API_KEY_EXPIRATION,
  getExpirationSeconds,
  isApiKeyExpiration,
} from "@/components/settings/api-keys/api-key-expirations";
import { ApiKeyExpiryToggle } from "@/components/settings/api-keys/api-key-expiry-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useCreateApiKey from "@/hooks/mutations/api-key/use-create-api-key";
import { toast } from "@/lib/toast";
import type { CreateApiKeyResponse } from "@/types/api-key";

type FormValues = {
  name: string;
  expiresIn: ApiKeyExpiration;
};

type CreateApiKeyDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: CreateApiKeyResponse) => void;
};

export function CreateApiKeyDialog({
  open,
  onClose,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: createApiKey, isPending } = useCreateApiKey();
  const expiresLabelId = useId();

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("settings:apiKey.createDialog.validation.nameRequired"))
          .min(3, t("settings:apiKey.createDialog.validation.nameShort")),
        expiresIn: z.custom<ApiKeyExpiration>(isApiKeyExpiration),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: { name: "", expiresIn: DEFAULT_API_KEY_EXPIRATION },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const result = await createApiKey({
        name: data.name,
        expiresIn: getExpirationSeconds(data.expiresIn),
      });
      form.reset();
      onSuccess(result);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:apiKey.createDialog.failedCreate"),
      );
    }
  };

  const handleClose = () => {
    if (isPending) return;
    form.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <Form {...form}>
          <form className="contents" onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>
                {t("settings:apiKey.createDialog.title")}
              </DialogTitle>
              <DialogDescription>
                {t("settings:apiKey.createDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <DialogPanel className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings:apiKey.createDialog.nameLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t(
                          "settings:apiKey.createDialog.namePlaceholder",
                        )}
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {t("settings:apiKey.createDialog.nameDescription")}
                    </FormDescription>
                    <FormMessage className="font-normal text-destructive-foreground text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiresIn"
                render={({ field }) => (
                  <FormItem>
                    <Label id={expiresLabelId} render={<span />}>
                      {t("settings:apiKey.createDialog.expirationLabel")}
                    </Label>
                    <ApiKeyExpiryToggle
                      labelledBy={expiresLabelId}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormItem>
                )}
              />
            </DialogPanel>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? t("settings:apiKey.createDialog.creating")
                  : t("settings:apiKey.createDialog.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
