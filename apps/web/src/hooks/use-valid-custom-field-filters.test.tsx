import { renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BoardFilters } from "./use-task-filters";
import {
  reconcileCustomFieldFilters,
  useValidCustomFieldFilters,
} from "./use-valid-custom-field-filters";

let fields:
  | { id: string; type: string; options: string[]; hiddenOptions: string[] }[]
  | undefined;
vi.mock("./queries/custom-field/use-get-custom-fields-by-project", () => ({
  default: () => ({ data: fields }),
}));
describe("persisted custom field filters", () => {
  it("reconciles the backlog's non-null filter map without changing empty state", () => {
    const empty = {};
    expect(reconcileCustomFieldFilters(empty, [])).toBe(empty);
    expect(
      reconcileCustomFieldFilters({ people: ["Old"] }, [
        { id: "people", type: "dropdown", options: ["New"] },
      ]) ?? {},
    ).toEqual({});
  });
  it("drops obsolete choices after loading or renaming while retaining historical hidden choices", async () => {
    fields = undefined;
    const { result, rerender } = renderHook(() => {
      const [filters, setFilters] = useState<BoardFilters>({
        status: ["planned"],
        priority: null,
        assignee: null,
        labels: null,
        dueDate: null,
        customFields: { people: ["Alice", "Bob"], removed: ["Gone"] },
      });
      useValidCustomFieldFilters("project", setFilters);
      return filters;
    });
    expect(result.current.customFields?.people).toEqual(["Alice", "Bob"]);
    fields = [
      {
        id: "people",
        type: "multiselect",
        options: ["Alex", "Bob"],
        hiddenOptions: ["Bob"],
      },
    ];
    rerender();
    await waitFor(() =>
      expect(result.current.customFields).toEqual({ people: ["Bob"] }),
    );
    fields = [{ ...fields[0], options: ["Alex", "Robert"] }];
    rerender();
    await waitFor(() => expect(result.current.customFields).toBeNull());
    expect(result.current.status).toEqual(["planned"]);
  });
});
