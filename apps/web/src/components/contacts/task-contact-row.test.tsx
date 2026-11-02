import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  contacts: [] as { id: string; name: string }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/contact/use-contacts", () => ({
  useContacts: () => ({ data: mocks.contacts }),
}));
vi.mock("@/hooks/mutations/contact/use-set-task-contact", () => ({
  useSetTaskContact: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

import { TaskContactRow } from "./task-contact-row";

afterEach(() => {
  cleanup();
  mocks.contacts = [];
});

const props = { taskId: "t1", workspaceId: "w1", canEdit: true };

describe("TaskContactRow", () => {
  it("is always shown, pointing at Contacts when the workspace has none yet", () => {
    render(<TaskContactRow {...props} contactId={null} />);

    expect(screen.getByText("workspace:contacts.taskLabel")).toBeTruthy();
    const link = screen.getByRole("link", {
      name: "workspace:contacts.addFirst",
    });
    expect(link.getAttribute("href")).toBe(
      "/dashboard/workspace/$workspaceId/contacts",
    );
  });

  it("offers a picker once contacts exist", () => {
    mocks.contacts = [{ id: "c1", name: "Ali Stores" }];
    render(<TaskContactRow {...props} contactId={null} />);

    expect(screen.getByText("workspace:contacts.taskLabel")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "workspace:contacts.taskLabel" }),
    ).toBeTruthy();
  });
});
