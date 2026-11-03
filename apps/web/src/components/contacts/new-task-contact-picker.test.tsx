import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  contacts: [] as { id: string; name: string }[],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/contact/use-contacts", () => ({
  useContacts: () => ({ data: mocks.contacts }),
}));

import { NewTaskContactPicker } from "./new-task-contact-picker";

afterEach(() => {
  cleanup();
  mocks.contacts = [];
});

describe("NewTaskContactPicker", () => {
  it("stays out of the way when the workspace has no contacts", () => {
    const { container } = render(
      <NewTaskContactPicker workspaceId="w1" value={null} onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the chosen contact and lets you pick or clear one", () => {
    mocks.contacts = [
      { id: "c1", name: "Ali Stores" },
      { id: "c2", name: "Blue Dive" },
    ];
    const onChange = vi.fn();
    render(
      <NewTaskContactPicker workspaceId="w1" value="c1" onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ali Stores" }));
    fireEvent.click(screen.getByRole("button", { name: "Blue Dive" }));
    expect(onChange).toHaveBeenLastCalledWith("c2");

    fireEvent.click(screen.getAllByRole("button", { name: "Ali Stores" })[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:contacts.noContact" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
