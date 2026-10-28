import { z } from "../../openapi";

const ENV_LOCKABLE = [
  "registrationEnabled",
  "passwordRegistrationEnabled",
  "workspaceCreationRestricted",
] as const;

export const updateInstanceSettingsBody = z
  .object({
    instanceName: z.string().trim().max(60).nullable().optional().openapi({
      description:
        "Shown in page titles and email headers and subjects. Empty or null restores Kaneo.",
    }),
    registrationEnabled: z.boolean().optional().openapi({
      description:
        "When false, only people with a valid invitation can create an account. Locked when `DISABLE_REGISTRATION=true`.",
    }),
    passwordRegistrationEnabled: z.boolean().optional().openapi({
      description:
        "When false, new accounts must use a social or OIDC provider. Locked when `DISABLE_PASSWORD_REGISTRATION=true`.",
    }),
    requireEmailVerification: z.boolean().optional().openapi({
      description:
        "New password sign-ups must confirm their email before they can sign in. Requires email delivery.",
    }),
    defaultRole: z.string().min(1).max(64).optional().openapi({
      description:
        "Instance role for new users: `user` or a custom role name, never `admin`. You can only choose a role whose permissions you have.",
    }),
    workspaceCreationRestricted: z.boolean().optional().openapi({
      description:
        "Only administrators can create workspaces. Locked when `DISABLE_WORKSPACE_CREATION=true`.",
    }),
    disabledIntegrations: z.array(z.string()).max(32).optional().openapi({
      description:
        "Integration provider types to turn off. Their connections stop syncing and delivering, and projects can't connect them.",
    }),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

export type UpdateInstanceSettingsInput = z.infer<
  typeof updateInstanceSettingsBody
>;

export const instanceSettingsSchema = z
  .object({
    instanceName: z.string().nullable().openapi({
      description: "The saved name, or null for the default Kaneo.",
    }),
    instanceUrl: z.string().nullable().openapi({
      description: "The web app URL from `KANEO_CLIENT_URL`. Read-only.",
    }),
    registrationEnabled: z.boolean(),
    passwordRegistrationEnabled: z.boolean(),
    requireEmailVerification: z.boolean(),
    defaultRole: z.string(),
    workspaceCreationRestricted: z.boolean(),
    disabledIntegrations: z.array(z.string()),
    lockedByEnv: z.array(z.enum(ENV_LOCKABLE)).openapi({
      description:
        "Settings an environment variable forces. Their values here are the effective ones.",
    }),
    emailDeliveryConfigured: z.boolean(),
    roles: z.array(z.string()).openapi({
      description: "Custom instance roles that can be the default role.",
    }),
    integrationProviders: z.array(
      z.object({ type: z.string(), name: z.string() }),
    ),
  })
  .openapi("InstanceSettings");
