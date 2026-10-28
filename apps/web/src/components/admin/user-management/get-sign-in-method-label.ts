type Translate = (key: string) => string;

const METHOD_LABEL_KEYS = new Map([
  ["credential", "settings:adminUsers.details.methods.password"],
  ["github", "auth:providers.github"],
  ["google", "auth:providers.google"],
  ["discord", "auth:providers.discord"],
]);

/** Human name for an account provider id; `custom` is the configured OIDC provider. */
export function getSignInMethodLabel(
  method: string,
  t: Translate,
  customOAuthName: string | null | undefined,
) {
  if (method === "custom") return customOAuthName || t("auth:providers.sso");
  const key = METHOD_LABEL_KEYS.get(method);
  return key ? t(key) : method;
}
