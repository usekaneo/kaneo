import { beforeEach, describe, expect, it, vi } from "vitest";
import archiveItemType from "@/fetchers/item-type/archive-item-type";
import createItemType from "@/fetchers/item-type/create-item-type";
import getItemTypes from "@/fetchers/item-type/get-item-types";
import updateItemType from "@/fetchers/item-type/update-item-type";
import getResolvedViews from "@/fetchers/saved-view/get-resolved-views";
import upsertSavedView from "@/fetchers/saved-view/upsert-saved-view";
import type { ItemType } from "@/types/item-type";
import type { ResolvedSavedView, SavedViewType } from "@/types/saved-view";

const mocks = vi.hoisted(() => ({
  archiveItemType: vi.fn(),
  createItemType: vi.fn(),
  getItemTypes: vi.fn(),
  getResolvedSavedViews: vi.fn(),
  updateItemType: vi.fn(),
  upsertSavedView: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    "item-type": {
      $post: mocks.createItemType,
      ":id": {
        $delete: mocks.archiveItemType,
        $put: mocks.updateItemType,
      },
      workspace: {
        ":workspaceId": {
          $get: mocks.getItemTypes,
        },
      },
    },
    "saved-view": {
      $post: mocks.upsertSavedView,
      workspace: {
        ":workspaceId": {
          project: {
            ":projectId": {
              $get: mocks.getResolvedSavedViews,
            },
          },
        },
      },
    },
  },
}));

const okResponse = (data: unknown) => ({
  ok: true,
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn(),
});

const errorResponse = (message: string) => ({
  ok: false,
  json: vi.fn(),
  text: vi.fn().mockResolvedValue(message),
});

describe("configurable work fetchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends item type requests through the typed Hono client", async () => {
    const itemType: ItemType = {
      id: "type-1",
      workspaceId: "workspace-1",
      key: "bug",
      name: "Bug",
      icon: "bug",
      description: null,
      position: 1,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mocks.createItemType.mockResolvedValue(okResponse(itemType));
    mocks.getItemTypes.mockResolvedValue(okResponse([itemType]));
    mocks.updateItemType.mockResolvedValue(okResponse(itemType));
    mocks.archiveItemType.mockResolvedValue(okResponse(itemType));

    await expect(
      createItemType({
        workspaceId: "workspace-1",
        key: "bug",
        name: "Bug",
        icon: "bug",
        description: null,
        position: 1,
      }),
    ).resolves.toEqual(itemType);
    await expect(getItemTypes({ workspaceId: "workspace-1" })).resolves.toEqual(
      [itemType],
    );
    await expect(
      updateItemType({
        id: "type-1",
        key: "bug",
        name: "Defect",
        icon: "bug",
        description: "Needs attention",
        position: 2,
      }),
    ).resolves.toEqual(itemType);
    await expect(archiveItemType({ id: "type-1" })).resolves.toEqual(itemType);

    expect(mocks.createItemType).toHaveBeenCalledWith({
      json: {
        workspaceId: "workspace-1",
        key: "bug",
        name: "Bug",
        icon: "bug",
        description: null,
        position: 1,
      },
    });
    expect(mocks.getItemTypes).toHaveBeenCalledWith({
      param: { workspaceId: "workspace-1" },
    });
    expect(mocks.updateItemType).toHaveBeenCalledWith({
      param: { id: "type-1" },
      json: {
        key: "bug",
        name: "Defect",
        icon: "bug",
        description: "Needs attention",
        position: 2,
      },
    });
    expect(mocks.archiveItemType).toHaveBeenCalledWith({
      param: { id: "type-1" },
    });
  });

  it("sends saved view requests with their complete API payload", async () => {
    const viewType: SavedViewType = "board";
    const view: ResolvedSavedView = {
      key: "board",
      name: "Board",
      type: viewType,
      position: 0,
      enabled: true,
      configuration: { groupBy: "status" },
    };
    mocks.getResolvedSavedViews.mockResolvedValue(okResponse([view]));
    mocks.upsertSavedView.mockResolvedValue(okResponse(view));

    await expect(getResolvedViews("workspace-1", "project-1")).resolves.toEqual(
      [view],
    );
    await expect(
      upsertSavedView({
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: null,
        key: "board",
        name: "Board",
        type: "board",
        position: 0,
        enabled: true,
        configuration: { groupBy: "status" },
      }),
    ).resolves.toEqual(view);

    expect(mocks.getResolvedSavedViews).toHaveBeenCalledWith({
      param: { workspaceId: "workspace-1", projectId: "project-1" },
    });
    expect(mocks.upsertSavedView).toHaveBeenCalledWith({
      json: {
        workspaceId: "workspace-1",
        projectId: "project-1",
        userId: null,
        key: "board",
        name: "Board",
        type: "board",
        position: 0,
        enabled: true,
        configuration: { groupBy: "status" },
      },
    });
  });

  it.each([
    [
      "create item type",
      mocks.createItemType,
      () => createItemType({ workspaceId: "w", key: "bug", name: "Bug" }),
    ],
    [
      "get item types",
      mocks.getItemTypes,
      () => getItemTypes({ workspaceId: "w" }),
    ],
    [
      "update item type",
      mocks.updateItemType,
      () =>
        updateItemType({
          id: "t",
          key: "bug",
          name: "Bug",
          icon: "bug",
          description: null,
          position: 0,
        }),
    ],
    [
      "archive item type",
      mocks.archiveItemType,
      () => archiveItemType({ id: "t" }),
    ],
    [
      "get saved views",
      mocks.getResolvedSavedViews,
      () => getResolvedViews("w", "p"),
    ],
    [
      "upsert saved view",
      mocks.upsertSavedView,
      () =>
        upsertSavedView({
          workspaceId: "w",
          key: "board",
          name: "Board",
          type: "board",
          position: 0,
          enabled: true,
          configuration: {},
        }),
    ],
  ])("uses the response text when %s fails", async (_name, request, call) => {
    request.mockResolvedValue(errorResponse("request failed"));

    await expect(call()).rejects.toThrow("request failed");
  });
});
