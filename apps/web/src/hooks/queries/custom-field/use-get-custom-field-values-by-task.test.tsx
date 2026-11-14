import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vite-plus/test";
import useGetCustomFieldValuesByTask from "./use-get-custom-field-values-by-task";

const getValues = vi.hoisted(() => vi.fn());

vi.mock("@/fetchers/custom-field/get-custom-field-values-by-task", () => ({
  default: getValues,
}));

it("refetches cached values when a task view mounts again", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  });
  client.setQueryData(
    ["custom-field-values", "task-1"],
    [{ fieldId: "size", value: "S" }],
  );
  getValues.mockResolvedValue([{ fieldId: "size", value: "L" }]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useGetCustomFieldValuesByTask("task-1"), {
    wrapper,
  });

  await waitFor(() =>
    expect(result.current.data).toEqual([{ fieldId: "size", value: "L" }]),
  );
  expect(getValues).toHaveBeenCalledWith({ taskId: "task-1" });
});
