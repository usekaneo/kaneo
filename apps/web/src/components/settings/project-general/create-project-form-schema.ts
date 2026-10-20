import type { TFunction } from "i18next";
import { z } from "zod";

export function createProjectFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("settings:projectGeneral.validation.nameRequired")),
    slug: z
      .string()
      .trim()
      .min(1, t("settings:projectGeneral.validation.keyRequired"))
      .max(8, t("settings:projectGeneral.validation.keyMax")),
    description: z.string().optional(),
    icon: z
      .string()
      .min(1, t("settings:projectGeneral.validation.iconRequired")),
  });
}
