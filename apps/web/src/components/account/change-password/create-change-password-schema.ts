import type { TFunction } from "i18next";
import { z } from "zod";

export type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function createChangePasswordSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t("settings:securityPage.validation.currentRequired")),
      newPassword: z
        .string()
        .min(8, t("settings:securityPage.validation.tooShort")),
      confirmPassword: z
        .string()
        .min(1, t("settings:securityPage.validation.confirmRequired")),
    })
    .refine((values) => values.newPassword !== values.currentPassword, {
      message: t("settings:securityPage.validation.sameAsCurrent"),
      path: ["newPassword"],
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t("settings:securityPage.validation.mismatch"),
      path: ["confirmPassword"],
    });
}
