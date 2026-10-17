import { describe, expect, it } from "vite-plus/test";
import {
  type CurrentCustomField,
  resolveFieldUpdate,
} from "../../../apps/api/src/custom-field/resolve-field-update";

const dropdown: CurrentCustomField = {
  name: "Size",
  type: "dropdown",
  required: false,
  defaultValue: "Medium",
  options: ["Small", "Medium", "Large"],
};

describe("resolveFieldUpdate", () => {
  it("keeps what the request leaves out", () => {
    expect(resolveFieldUpdate(dropdown, { name: "  T-shirt size " })).toEqual({
      ...dropdown,
      name: "T-shirt size",
      removedOptions: [],
    });
  });

  it("rejects type changes other than dropdown and multiselect", () => {
    expect(() =>
      resolveFieldUpdate(
        { ...dropdown, type: "text", options: null, defaultValue: null },
        { type: "number" },
      ),
    ).toThrow("can't change");
  });

  it("rejects a blank name", () => {
    expect(() => resolveFieldUpdate(dropdown, { name: "  " })).toThrow(
      "Name cannot be empty",
    );
  });

  it("reports removed options and checks the default against new options", () => {
    expect(
      resolveFieldUpdate(dropdown, { options: ["Medium", "XL", "Medium"] }),
    ).toMatchObject({
      options: ["Medium", "XL"],
      removedOptions: ["Small", "Large"],
    });
    expect(() =>
      resolveFieldUpdate(dropdown, { options: ["Small", "Large"] }),
    ).toThrow("Default value must be one of the dropdown options");
  });

  it("converts the default when switching to multiselect", () => {
    expect(resolveFieldUpdate(dropdown, { type: "multiselect" })).toMatchObject(
      { type: "multiselect", defaultValue: '["Medium"]' },
    );
  });

  it("clears the default with null and requires one for required fields", () => {
    expect(
      resolveFieldUpdate(dropdown, { defaultValue: null }).defaultValue,
    ).toBeNull();
    expect(() =>
      resolveFieldUpdate(dropdown, { defaultValue: "", required: true }),
    ).toThrow("Required fields must have a default value");
  });

  it("rejects options on fields without options", () => {
    expect(() =>
      resolveFieldUpdate(
        { ...dropdown, type: "text", options: null, defaultValue: null },
        { options: ["a"] },
      ),
    ).toThrow("Only dropdown and multiselect fields have options");
  });
});
