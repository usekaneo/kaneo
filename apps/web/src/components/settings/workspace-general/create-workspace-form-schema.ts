import type { TFunction } from "i18next";
import { z } from "zod";

export function createWorkspaceFormSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .min(1, t("settings:workspaceGeneral.validation.nameRequired"))
      .min(2, t("settings:workspaceGeneral.validation.nameShort")),
    description: z.string().optional(),
  });
}
