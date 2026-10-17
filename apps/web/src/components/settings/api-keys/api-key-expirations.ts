export const API_KEY_EXPIRATIONS = [
  {
    value: "1d",
    seconds: 86_400,
    labelKey: "settings:apiKey.createDialog.expiration1d",
  },
  {
    value: "7d",
    seconds: 604_800,
    labelKey: "settings:apiKey.createDialog.expiration7d",
  },
  {
    value: "30d",
    seconds: 2_592_000,
    labelKey: "settings:apiKey.createDialog.expiration30d",
  },
  {
    value: "90d",
    seconds: 7_776_000,
    labelKey: "settings:apiKey.createDialog.expiration90d",
  },
  {
    value: "never",
    seconds: null,
    labelKey: "settings:apiKey.createDialog.expirationNever",
  },
] as const;

export type ApiKeyExpiration = (typeof API_KEY_EXPIRATIONS)[number]["value"];

export const DEFAULT_API_KEY_EXPIRATION: ApiKeyExpiration = "30d";

export function isApiKeyExpiration(value: unknown): value is ApiKeyExpiration {
  return API_KEY_EXPIRATIONS.some((option) => option.value === value);
}

export function getExpirationSeconds(value: ApiKeyExpiration): number | null {
  return (
    API_KEY_EXPIRATIONS.find((option) => option.value === value)?.seconds ??
    null
  );
}
