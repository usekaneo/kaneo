import { checkSettingField } from "./check-setting-field.js";
import { isRecord } from "./is-record.js";

export function checkSettingsSchema(schema: unknown): string[] {
  if (!isRecord(schema)) return ["Settings must be an object of fields"];
  return Object.entries(schema).flatMap(([key, field]) =>
    checkSettingField(key, field),
  );
}
