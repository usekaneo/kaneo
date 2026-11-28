type SettingBase = {
  label: string;
  description?: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type TextSetting = SettingBase & {
  type: "text";
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  default?: string;
};

export type SecretSetting = SettingBase & {
  type: "secret";
  placeholder?: string;
  required?: boolean;
};

export type NumberSetting = SettingBase & {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  default?: number;
};

export type BooleanSetting = SettingBase & {
  type: "boolean";
  default?: boolean;
};

export type SelectSetting = SettingBase & {
  type: "select";
  options: readonly SelectOption[];
  required?: boolean;
  default?: string;
};

export type MultiSelectSetting = SettingBase & {
  type: "multiselect";
  options: readonly SelectOption[];
  default?: readonly string[];
};

export type SettingField =
  | TextSetting
  | SecretSetting
  | NumberSetting
  | BooleanSetting
  | SelectSetting
  | MultiSelectSetting;

export type SettingsSchema = Readonly<Record<string, SettingField>>;

type AlwaysPresent<F> = F extends { default: unknown }
  ? true
  : F extends { required: true }
    ? true
    : false;

type RawSettingValue<F> = F extends BooleanSetting
  ? boolean
  : F extends MultiSelectSetting
    ? F["options"][number]["value"][]
    : F extends SelectSetting
      ? F["options"][number]["value"]
      : F extends NumberSetting
        ? number
        : string;

export type SettingValue<F> = F extends BooleanSetting | MultiSelectSetting
  ? RawSettingValue<F>
  : AlwaysPresent<F> extends true
    ? RawSettingValue<F>
    : RawSettingValue<F> | undefined;

export type SettingsValues<S extends SettingsSchema> = {
  -readonly [K in keyof S]: SettingValue<S[K]>;
};

export type PublicSettingsValues<S extends SettingsSchema> = {
  -readonly [
    K in keyof S as S[K] extends SecretSetting ? never : K
  ]: SettingValue<S[K]>;
};

export type SettingsErrors = Record<string, string>;

export type ParseSettingsResult =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: SettingsErrors };

export type PublicSettings = {
  values: Record<string, unknown>;
  configuredSecrets: string[];
};
