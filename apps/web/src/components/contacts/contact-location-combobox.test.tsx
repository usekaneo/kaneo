import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

import { ContactLocationCombobox } from "./contact-location-combobox";

afterEach(cleanup);

const items = [
  { value: "", label: "Not set" },
  { value: "male", label: "Malé" },
  ...Array.from({ length: 300 }, (_, i) => ({
    value: `k${i}`,
    label: `Island ${i}`,
  })),
];

describe("ContactLocationCombobox", () => {
  it("shows the chosen location and falls back to the none choice", () => {
    const { rerender } = render(
      <ContactLocationCombobox
        value="male"
        items={items}
        label="Location"
        onValueChange={vi.fn()}
      />,
    );
    expect((screen.getByLabelText("Location") as HTMLInputElement).value).toBe(
      "Malé",
    );

    rerender(
      <ContactLocationCombobox
        value="deleted-key"
        items={items}
        label="Location"
        onValueChange={vi.fn()}
      />,
    );
    // The none choice is the placeholder, not text the user would have to delete.
    const input = screen.getByLabelText("Location") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Not set");
  });

  it("selects the shown location when clicked or focused, so typing replaces it", () => {
    render(
      <ContactLocationCombobox
        value="male"
        items={items}
        label="Location"
        onValueChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Location") as HTMLInputElement;

    fireEvent.click(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it("lists every location when opened with one already chosen", async () => {
    render(
      <ContactLocationCombobox
        value="male"
        items={items}
        label="Location"
        onValueChange={vi.fn()}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Location"), { key: "ArrowDown" });

    expect((await screen.findAllByRole("option")).length).toBeGreaterThan(100);
  });

  it("filters a long list as you type and reports the picked key", async () => {
    const onValueChange = vi.fn();
    render(
      <ContactLocationCombobox
        value=""
        items={items}
        label="Location"
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByLabelText("Location");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await screen.findAllByRole("option");
    fireEvent.change(input, { target: { value: "island 299" } });

    const option = await screen.findByRole("option", { name: "Island 299" });
    expect(screen.queryByRole("option", { name: "Island 3" })).toBeNull();
    fireEvent.click(option);

    expect(onValueChange).toHaveBeenCalledWith("k299");
  });
});
