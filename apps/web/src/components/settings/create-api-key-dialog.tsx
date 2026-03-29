import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import useCreateApiKey from "@/hooks/mutations/api-key/use-create-api-key";
import { toast } from "@/lib/toast";
import type { CreateApiKeyResponse } from "@/types/api-key";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const EXPIRATION_SECONDS = {
  "1d": 86400,
  "7d": 604800,
  "30d": 2592000,
  "90d": 7776000,
} as const;

type FormValues = {
  name: string;
  expiresIn: string;
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
  const { mutateAsync: createApiKey } = useCreateApiKey();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createApiKeySchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t("settings:apiKey.createDialog.validation.nameRequired"))
          .min(3, t("settings:apiKey.createDialog.validation.nameShort")),
        expiresIn: z
          .string()
          .min(
            1,
            t("settings:apiKey.createDialog.validation.expirationRequired"),
          ),
      }),
    [t],
  );

  const expirationOptions = useMemo(
    () =>
      [
        {
          label: t("settings:apiKey.createDialog.expiration1d"),
          value: "1d",
        },
        {
          label: t("settings:apiKey.createDialog.expiration7d"),
          value: "7d",
        },
        {
          label: t("settings:apiKey.createDialog.expiration30d"),
          value: "30d",
        },
        {
          label: t("settings:apiKey.createDialog.expiration90d"),
          value: "90d",
        },
        {
          label: t("settings:apiKey.createDialog.expirationNever"),
          value: "never",
        },
      ] as const,
    [t],
  );

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(createApiKeySchema),
    defaultValues: {
      name: "",
      expiresIn: "30d",
    },
  });

  const onSubmit = async (data: FormValues) => {
    const expiresInValue =
      data.expiresIn === "never"
        ? null
        : EXPIRATION_SECONDS[data.expiresIn as keyof typeof EXPIRATION_SECONDS];

    setIsSubmitting(true);
    try {
      const result = await createApiKey({
        name: data.name,
        expiresIn: expiresInValue ?? null,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b border-border">
          <DialogTitle>{t("settings:apiKey.createDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("settings:apiKey.createDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            <div className="space-y-5 px-6 py-5">
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
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("settings:apiKey.createDialog.nameDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("settings:apiKey.createDialog.expirationLabel")}
                    </FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "settings:apiKey.createDialog.expirationPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {expirationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      {t("settings:apiKey.createDialog.expirationDescription")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? t("settings:apiKey.createDialog.creating")
                  : t("settings:apiKey.createDialog.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
