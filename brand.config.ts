/**
 * ElseTasks platform branding defaults.
 * Client whitelabel (logo/colors/name) overrides these at runtime via instance_branding.
 */
export const platformBrand = {
  name: "ElseTasks",
  shortName: "ElseTasks",
  tagline: "Project management that fits your team.",
  url: process.env.APP_URL || "https://app.elsetasks.com",
  supportEmail: process.env.APP_SUPPORT_EMAIL || "suporte@elsetasks.com",
  docsUrl: process.env.APP_DOCS_URL || "https://docs.elsetasks.com",
  primaryColor: process.env.APP_PRIMARY_COLOR || "#0F766E",
  logoLightPath: "/logo-light.svg",
  logoDarkPath: "/logo-dark.svg",
  attribution: "Based on Kaneo (MIT)",
} as const;

export type PlatformBrand = typeof platformBrand;
