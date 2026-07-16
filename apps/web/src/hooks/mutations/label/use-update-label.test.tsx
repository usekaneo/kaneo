import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useUpdateLabel from "./use-update-label";

const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useMutation: (options: { onSuccess?: (data: unknown) => void }) => {
    const mutateAsync = vi
      .fn()
      .mockImplementation(
        async (vars: { id: string; name: string; color: string }) => {
          const result = {
            id: vars.id,
            name: vars.name,
            color: vars.color,
            workspaceId: "workspace-1",
            taskId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await options.onSuccess?.(result);
          return result;
        },
      );

    return {
      mutateAsync,
      isPending: false,
    };
  },
}));

vi.mock("@/fetchers/label/update-label", () => ({
  default: vi.fn(),
}));

describe("useUpdateLabel", () => {
  beforeEach(() => {
    mockInvalidateQueries.mockClear();
  });

  it("invalidates label and task caches on success", async () => {
    const { result } = renderHook(() => useUpdateLabel());

    await result.current.mutateAsync({
      id: "label-1",
      name: "Updated Label",
      color: "purple",
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["labels"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tasks"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["task"],
    });
  });

  it("invalidates with the correct workspaceId from the response", async () => {
    const { result } = renderHook(() => useUpdateLabel());

    await result.current.mutateAsync({
      id: "label-2",
      name: "Bug",
      color: "red",
    });

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["labels"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["tasks"],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["task"],
    });
  });
});
