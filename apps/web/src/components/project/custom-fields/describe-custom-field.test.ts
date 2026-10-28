import { describe, expect, it } from "vite-plus/test";
import {
  describeCustomField,
  formatDateDefault,
} from "@/components/project/custom-fields/describe-custom-field";

const english: Record<string, string> = {
  "settings:customFields.types.text": "Text",
  "settings:customFields.types.number": "Number",
  "settings:customFields.types.date": "Date",
  "settings:customFields.types.dropdown": "Dropdown",
  "settings:customFields.types.multiselect": "Dropdown, pick several",
  "settings:customFields.types.boolean": "Checkbox",
  "settings:customFields.moreOptions": "+{{hiddenCount}} more",
  "settings:customFields.startsAs": "Starts as “{{value}}”",
  "settings:customFields.startsAt": "Starts at {{value}}",
  "settings:customFields.startsOn": "Starts on {{date}}",
  "settings:customFields.startsChecked": "Starts checked",
  "settings:customFields.startsUnchecked": "Starts unchecked",
};

const t = (key: string, options: Record<string, unknown> = {}) =>
  (english[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(options[name]),
  );

function describeField(
  type: Parameters<typeof describeCustomField>[0]["type"],
  defaultValue: string | null = null,
  options: string[] | null = null,
) {
  return describeCustomField({ type, defaultValue, options }, t, "en-US");
}

describe("describeCustomField", () => {
  it("lists dropdown options", () => {
    expect(
      describeField("dropdown", "Medium", ["Small", "Medium", "Large"]),
    ).toBe("Dropdown · Small, Medium, Large");
    expect(describeField("multiselect", null, ["iOS", "Android", "Web"])).toBe(
      "Dropdown, pick several · iOS, Android, Web",
    );
  });

  it("truncates long option lists", () => {
    expect(describeField("dropdown", null, ["XS", "S", "M", "L", "XL"])).toBe(
      "Dropdown · XS, S, M +2 more",
    );
  });

  it("mentions the starting value", () => {
    expect(describeField("text", "Internal")).toBe(
      "Text · Starts as “Internal”",
    );
    expect(describeField("number", "5")).toBe("Number · Starts at 5");
    expect(describeField("date", "2026-03-12")).toBe(
      "Date · Starts on Mar 12, 2026",
    );
  });

  it("keeps fields without a default short", () => {
    expect(describeField("text")).toBe("Text");
    expect(describeField("number", "  ")).toBe("Number");
    expect(describeField("date")).toBe("Date");
  });

  it("describes checkbox defaults", () => {
    expect(describeField("boolean", "true")).toBe("Checkbox · Starts checked");
    expect(describeField("boolean", "false")).toBe(
      "Checkbox · Starts unchecked",
    );
    expect(describeField("boolean")).toBe("Checkbox · Starts unchecked");
  });
});

describe("formatDateDefault", () => {
  it("formats the calendar day without shifting time zones", () => {
    expect(formatDateDefault("2026-01-01T23:30:00-05:00", "en-US")).toBe(
      "Jan 1, 2026",
    );
  });

  it("returns values it cannot read unchanged", () => {
    expect(formatDateDefault("soon", "en-US")).toBe("soon");
  });
});
