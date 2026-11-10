import { describe, it, expect } from "vite-plus/test";
import { prepareArchive } from "./import-archive";
import { collectStorageKeys, type WorkspaceArchive } from "./archive";
const base = (): WorkspaceArchive => ({
  format: "quills-workspace",
  version: 1,
  origin: "quackback",
  createdAt: new Date().toISOString(),
  tables: {},
  storageKeys: [],
  omittedTables: [],
});
describe("Workspace archive validation", () => {
  it("requires explicit canonical staff and native resource mappings", () => {
    const archive = base();
    archive.tables.principal = [
      { id: "old-staff", role: "admin", type: "user", display_name: "Old" },
    ];
    expect(() => prepareArchive(archive, {}, "target", [])).toThrow(
      "Explicit mapping",
    );
    const result = prepareArchive(
      archive,
      { actors: { "old-staff": "current" } },
      "target",
      [{ id: "current", name: "Current", image: null }],
    );
    expect(result.tables.principal![0]).toMatchObject({
      workspace_id: "target",
      kaneo_user_id: "current",
      display_name: "Current",
      role: "user",
      user_id: null,
    });
    archive.tables.board_projects = [
      { board_id: "board", project_id: "foreign" },
    ];
    expect(() =>
      prepareArchive(
        archive,
        { actors: { "old-staff": "current" } },
        "target",
        [{ id: "current", name: "Current", image: null }],
      ),
    ).toThrow("Explicit project mapping");
  });
  it("remaps only storage fields, derives keys from data, and ignores forged manifest keys", () => {
    const archive = base();
    archive.tables.files = [
      {
        id: "same",
        name: "old/key",
        storage_key: "old/key",
        meta: { thumbKey: "old/thumb", label: "old/key" },
      },
    ];
    archive.tables.conversation_messages = [
      { attachments: [{ preview: { renditionKey: "old/video" } }] },
    ];
    archive.storageKeys = ["forged/key"];
    const result = prepareArchive(
      archive,
      {
        storage: {
          "old/key": "new/key",
          "old/thumb": "new/thumb",
          "old/video": "new/video",
          same: "bad-id",
        },
      },
      "target",
      [],
    );
    expect(result.tables.files![0]).toMatchObject({
      id: "same",
      name: "old/key",
      storage_key: "new/key",
      meta: { thumbKey: "new/thumb", label: "old/key" },
    });
    expect(collectStorageKeys(result.tables).sort()).toEqual([
      "new/key",
      "new/thumb",
      "new/video",
    ]);
  });
  it("rejects public numbers that cannot be allocated safely", () => {
    for (const number of [0, -1, "9007199254740991", "9223372036854775807"]) {
      const archive = base();
      archive.tables.tickets = [{ number }];
      expect(() => prepareArchive(archive, {}, "target", [])).toThrow(
        "Unsupported public number",
      );
    }
    const archive = base();
    archive.tables.kb_articles = [{ url_id: 2147483647 }];
    expect(() => prepareArchive(archive, {}, "target", [])).toThrow(
      "Unsupported public number",
    );
  });
  it("rejects unknown tables, columns, versions and malformed mappings", () => {
    const archive = base();
    archive.tables.session = [];
    expect(() => prepareArchive(archive, {}, "target", [])).toThrow(
      "Unsupported archive table",
    );
    archive.tables = { boards: [{ invented_column: true }] };
    expect(() => prepareArchive(archive, {}, "target", [])).toThrow(
      "Unknown archive column",
    );
    expect(() =>
      prepareArchive({ ...base(), version: 2 }, {}, "target", []),
    ).toThrow();
    expect(() =>
      prepareArchive(base(), { actors: { x: "" } }, "target", []),
    ).toThrow();
  });
});
