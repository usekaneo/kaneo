import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import useGetCachedCustomFieldValues from "./use-get-all-custom-field-values-by-project";
import type { CustomFieldValue } from "./use-get-custom-field-values-by-project";

const fieldValue: CustomFieldValue = {
  id: "value-1",
  taskId: "unopened-task",
  fieldId: "size",
  value: "L",
  fieldName: "Size",
  fieldPosition: 0,
  fieldType: "dropdown",
  fieldOptions: ["S", "L"],
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["custom-field-values", "project-1"], [fieldValue]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("project custom-field filter values", () => {
  it("finds values without opening a task and ignores stale task-detail data", () => {
    const { client, wrapper } = setup();
    client.setQueryData(
      ["custom-field-values", "unopened-task"],
      [{ ...fieldValue, value: "S" }],
    );
    const { result } = renderHook(
      () => useGetCachedCustomFieldValues("project-1"),
      { wrapper },
    );

    expect(result.current.getValuesForTask("unopened-task")).toEqual([
      fieldValue,
    ]);
    expect(result.current.getValuesForTask("missing-task")).toEqual([]);
  });

  it("refreshes filter values when the project query changes", async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => useGetCachedCustomFieldValues("project-1"),
      { wrapper },
    );

    act(() => {
      client.setQueryData(
        ["custom-field-values", "project-1"],
        [{ ...fieldValue, value: "S" }],
      );
    });
    await waitFor(() => {
      expect(result.current.getValuesForTask("unopened-task")[0]?.value).toBe(
        "S",
      );
    });
  });

  it("does not reuse values after switching to another project", () => {
    const { client, wrapper } = setup();
    client.setQueryData(["custom-field-values", "project-2"], []);
    const { result, rerender } = renderHook(
      ({ projectId }) => useGetCachedCustomFieldValues(projectId),
      { wrapper, initialProps: { projectId: "project-1" } },
    );
    rerender({ projectId: "project-2" });
    expect(result.current.getValuesForTask("unopened-task")).toEqual([]);
  });
});
