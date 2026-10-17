import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ProjectSearch } from "./project-search";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState("");
  return <ProjectSearch value={value} onChange={setValue} />;
}

it("starts as an icon and opens a search field", () => {
  render(<Harness />);
  expect(screen.queryByRole("searchbox")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "tasks:toolbar.search" }));
  const field = screen.getByRole("searchbox", { name: "tasks:toolbar.search" });
  expect(field).toHaveFocus();

  fireEvent.change(field, { target: { value: "invite" } });
  fireEvent.blur(field);
  expect(screen.getByRole("searchbox")).toHaveValue("invite");
});

it("opens with Cmd or Ctrl and F", () => {
  render(<Harness />);
  fireEvent.keyDown(window, { key: "f", metaKey: true });
  expect(screen.getByRole("searchbox")).toHaveFocus();
});
