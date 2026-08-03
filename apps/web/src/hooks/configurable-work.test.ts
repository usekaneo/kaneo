import { beforeEach, describe, expect, it, vi } from "vitest";
import useArchiveItemType from "@/hooks/mutations/item-type/use-archive-item-type";
import useCreateItemType from "@/hooks/mutations/item-type/use-create-item-type";
import useUpdateItemType from "@/hooks/mutations/item-type/use-update-item-type";
import useUpsertSavedView from "@/hooks/mutations/saved-view/use-upsert-saved-view";
import useGetItemTypes from "@/hooks/queries/item-type/use-get-item-types";
import useGetResolvedViews from "@/hooks/queries/saved-view/use-get-resolved-views";

const mocks = vi.hoisted(() => ({
  archiveItemType: vi.fn(),
  createItemType: vi.fn(),
  getItemTypes: vi.fn(),
  getResolvedViews: vi.fn(),
  invalidateQueries: vi.fn(),
  mutationOptions: [] as Array<Record<string, unknown>>,
  queryOptions: [] as Array<Record<string, unknown>>,
  setQueryData: vi.fn(),
  updateItemType: vi.fn(),
  upsertSavedView: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: Record<string, unknown>) => {
    mocks.mutationOptions.push(options);
    return options;
  },
  useQuery: (options: Record<string, unknown>) => {
    mocks.queryOptions.push(options);
    return options;
  },
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}));

vi.mock("@/fetchers/item-type/archive-item-type", () => ({
  default: mocks.archiveItemType,
}));
vi.mock("@/fetchers/item-type/create-item-type", () => ({
  default: mocks.createItemType,
}));
vi.mock("@/fetchers/item-type/get-item-types", () => ({
  default: mocks.getItemTypes,
}));
vi.mock("@/fetchers/item-type/update-item-type", () => ({
  default: mocks.updateItemType,
}));
vi.mock("@/fetchers/saved-view/get-resolved-views", () => ({
  default: mocks.getResolvedViews,
}));
vi.mock("@/fetchers/saved-view/upsert-saved-view", () => ({
  default: mocks.upsertSavedView,
}));

describe("configurable work query hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutationOptions.length = 0;
    mocks.queryOptions.length = 0;
  });

  it("queries item types by workspace", async () => {
    useGetItemTypes("workspace-1");

    const options = mocks.queryOptions[0] as {
      enabled: boolean;
      queryKey: string[];
      queryFn: () => Promise<unknown>;
    };
    expect(options.queryKey).toEqual(["item-types", "workspace-1"]);
    expect(options.enabled).toBe(true);
    await options.queryFn();
    expect(mocks.getItemTypes).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
    });
  });

  it("disables item type queries without a workspace", () => {
    useGetItemTypes("");

    expect(mocks.queryOptions[0]).toMatchObject({ enabled: false });
  });

  it("queries resolved views by workspace and project", async () => {
    useGetResolvedViews({
      workspaceId: "workspace-1",
      projectId: "project-1",
    });

    const options = mocks.queryOptions[0] as {
      enabled: boolean;
      queryKey: string[];
      queryFn: () => Promise<unknown>;
    };
    expect(options.queryKey).toEqual([
      "saved-views",
      "workspace-1",
      "project-1",
    ]);
    expect(options.enabled).toBe(true);
    await options.queryFn();
    expect(mocks.getResolvedViews).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      projectId: "project-1",
    });
  });

  it("disables resolved view queries if either scope id is missing", () => {
    useGetResolvedViews({ workspaceId: "workspace-1", projectId: "" });

    expect(mocks.queryOptions[0]).toMatchObject({ enabled: false });
  });
});

describe("configurable work mutation hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutationOptions.length = 0;
    mocks.queryOptions.length = 0;
  });

  it.each([
    ["create", useCreateItemType, mocks.createItemType],
    ["update", useUpdateItemType, mocks.updateItemType],
    ["archive", useArchiveItemType, mocks.archiveItemType],
  ])(
    "uses the %s item type fetcher and invalidates the full domain",
    async (_name, useHook, fetcher) => {
      useHook();

      const options = mocks.mutationOptions[0] as {
        mutationFn: unknown;
        onSuccess: () => Promise<void> | void;
      };
      expect(options.mutationFn).toBe(fetcher);
      await options.onSuccess();
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["item-types"],
      });
      expect(mocks.setQueryData).not.toHaveBeenCalled();
    },
  );

  it("uses the aligned upsert payload and invalidates the full saved view domain", async () => {
    useUpsertSavedView();

    const options = mocks.mutationOptions[0] as {
      mutationFn: unknown;
      onSuccess: () => Promise<void> | void;
    };
    expect(options.mutationFn).toBe(mocks.upsertSavedView);
    await options.onSuccess();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["saved-views"],
    });
    expect(mocks.setQueryData).not.toHaveBeenCalled();
  });
});
