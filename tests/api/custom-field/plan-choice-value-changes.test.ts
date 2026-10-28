import { describe, expect, it } from "vite-plus/test";
import { planChoiceValueChanges } from "../../../apps/api/src/custom-field/plan-choice-value-changes";

describe("planChoiceValueChanges", () => {
  it("allows removing options no task uses", () => {
    expect(
      planChoiceValueChanges({
        values: ["Small", null],
        from: "dropdown",
        to: "dropdown",
        removedOptions: ["Large"],
      }),
    ).toEqual([]);
  });

  it("rejects removing an option a task uses", () => {
    expect(() =>
      planChoiceValueChanges({
        values: ["Small"],
        from: "dropdown",
        to: "dropdown",
        removedOptions: ["Small"],
      }),
    ).toThrow('Can\'t remove "Small" because tasks still use it.');
  });

  it("converts each distinct value once when allowing several", () => {
    expect(
      planChoiceValueChanges({
        values: ["Small", "Small", "", null],
        from: "dropdown",
        to: "multiselect",
        removedOptions: [],
      }),
    ).toEqual([{ from: "Small", to: '["Small"]' }]);
  });

  it("rejects turning off several picks while a task has more than one", () => {
    expect(() =>
      planChoiceValueChanges({
        values: ['["iOS"]', '["iOS","Web"]'],
        from: "multiselect",
        to: "dropdown",
        removedOptions: [],
      }),
    ).toThrow("more than one option");
  });
});
