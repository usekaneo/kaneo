import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AutomationCard } from "./automation-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);

describe("Tangled automation", () => {
  it("shows only supported branch pushes, not deferred PR or issue events", () => {
    render(
      <AutomationCard
        connection={{
          id: "tangled",
          name: "Tangled",
          icon: () => <svg />,
          iconClassName: "",
          status: { state: "connected" },
        }}
        columns={[]}
        rules={[]}
        canEdit
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText("settings:workflowEditor.events.branch_push"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("settings:workflowEditor.events.pr_opened"),
    ).toBeNull();
    expect(
      screen.queryByText("settings:workflowEditor.events.pr_merged"),
    ).toBeNull();
    expect(
      screen.queryByText("settings:workflowEditor.events.issue_opened"),
    ).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});
