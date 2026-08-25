import { z } from "../openapi";

export const configSchema = z
  .object({
    disableRegistration: z.boolean(),
    disablePasswordRegistration: z.boolean(),
    disableEmailOtpSignIn: z.boolean(),
    disableWorkspaceCreation: z.boolean(),
    isDemoMode: z.boolean(),
    hasSmtp: z.boolean(),
    hasGithubSignIn: z.boolean(),
    hasGoogleSignIn: z.boolean(),
    hasDiscordSignIn: z.boolean(),
    hasCustomOAuth: z.boolean(),
    hasGuestAccess: z.boolean(),
    disableLoginForm: z.boolean(),
    customOAuthAutoLogin: z.boolean(),
    customOAuthLogoutUrl: z.string().nullable(),
    billingEnabled: z.boolean(),
  })
  .openapi("Config");
