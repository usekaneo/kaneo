import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useTaskCustomFields } from "./use-task-custom-fields";

const mutateAsync = vi.fn();
const toastError = vi.fn();
const field = {
  id: "customer",
  projectId: "project-1",
  name: "Customer",
  type: "text",
  required: false,
  defaultValue: null,
  options: null,
  position: 0,
  createdAt: "",
  updatedAt: "",
};
const stored = [{ fieldId: "customer", value: "Acme" }];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({
    default: () => ({ data: [field] }),
  }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-values-by-task",
  () => ({ default: () => ({ data: stored }) }),
);
vi.mock("@/hooks/mutations/custom-field/use-set-custom-field-value", () => ({
  default: () => ({ mutateAsync }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTaskCustomFields", () => {
  it("shows the new value while saving", async () => {
    let finish: () => void = () => {};
    mutateAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useTaskCustomFields("task-1", "project-1"),
    );
    act(() => {
      void result.current.save(result.current.fields[0], "Globex");
    });
    expect(result.current.values.customer).toBe("Globex");
    expect(mutateAsync).toHaveBeenCalledWith({
      taskId: "task-1",
      fieldId: "customer",
      value: "Globex",
      projectId: "project-1",
    });
    await act(async () => finish());
  });

  it("rolls back and reports when the save fails", async () => {
    mutateAsync.mockRejectedValue(new Error("This custom field is required"));
    const { result } = renderHook(() =>
      useTaskCustomFields("task-1", "project-1"),
    );
    await act(async () => {
      await result.current.save(result.current.fields[0], "");
    });
    expect(result.current.values.customer).toBe("Acme");
    expect(toastError).toHaveBeenCalledWith("This custom field is required");
  });
});
