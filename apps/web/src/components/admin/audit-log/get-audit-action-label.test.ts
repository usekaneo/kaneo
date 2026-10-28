import { describe, expect, it } from "vite-plus/test";
import { getAuditActionLabel } from "./get-audit-action-label";

const t = (key: string) => `t(${key})`;

describe("getAuditActionLabel", () => {
  it("labels plugin data purges", () => {
    expect(getAuditActionLabel("instance.plugin_data_purged", t)).toBe(
      "t(settings:adminAuditLog.actions.pluginDataPurged)",
    );
  });

  it("shows actions this client does not know as they are", () => {
    expect(getAuditActionLabel("plugin.unknown", t)).toBe("plugin.unknown");
  });
});
