import type en from "@i18n/en-US.json";

// Typed keys: `t()` rejects a key that en-US.json does not define.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "mobile";
    resources: typeof en;
  }
}
