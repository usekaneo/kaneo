import { describe, expect, it, vi } from "vite-plus/test";
import { rootFilterEntries, subjectFilterEntries } from "./filter-entries";
import type { FilterSubject } from "./filter-subject";

const subject = (overrides: Partial<FilterSubject>): FilterSubject => ({
  id: "priority",
  label: "Priority",
  icon: null,
  kind: "core",
  operators: { positive: "is", negative: "is not" },
  options: [
    { value: "high", label: "High" },
    { value: "low", label: "Low" },
  ],
  selected: ["high"],
  negated: false,
  onToggle: vi.fn(),
  onNegate: vi.fn(),
  onClear: vi.fn(),
  emptyLabel: "None",
  ...overrides,
});

const priority = subject({});
const size = subject({
  id: "customField:size",
  label: "Size",
  kind: "customField",
  options: [{ value: "L", label: "Large" }],
  selected: [],
});

describe("rootFilterEntries", () => {
  it("lists subjects, with custom fields in their own group", () => {
    const groups = rootFilterEntries([priority, size], "", "Custom fields");
    expect(groups.map((group) => group.label)).toEqual([
      undefined,
      "Custom fields",
    ]);
    expect(groups[0].items[0]).toMatchObject({
      label: "Priority",
      badge: 1,
      opensSubject: "priority",
    });
  });

  it("searches subjects and values together", () => {
    expect(
      rootFilterEntries([priority, size], "pri", "Custom fields")[0].items.map(
        (item) => item.label,
      ),
    ).toEqual(["Priority"]);

    const groups = rootFilterEntries([priority, size], "l", "Custom fields");
    const values = groups.flatMap((group) => group.items);
    expect(values.map((item) => [item.label, item.meta])).toEqual([
      ["Low", "Priority"],
      ["Large", "Size"],
    ]);

    values[0].toggle?.();
    expect(priority.onToggle).toHaveBeenCalledWith("low");
  });
});

it("lists one subject's values with their checked state and counts", () => {
  const counted = subject({
    options: [
      { value: "high", label: "High", count: 3 },
      { value: "low", label: "Low" },
    ],
  });
  const [group] = subjectFilterEntries(counted, "", (n) => `${n} tasks`);
  expect(
    group.items.map((item) => [item.label, item.checked, item.meta]),
  ).toEqual([
    ["High", true, "3 tasks"],
    ["Low", false, undefined],
  ]);
  expect(subjectFilterEntries(counted, "zzz", String)).toEqual([]);
});
