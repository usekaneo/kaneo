import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      `${key}:${options?.name ?? ""}`,
  }),
}));

import { ContactOptionEditableLabel } from "./contact-option-editable-label";

afterEach(cleanup);

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ContactOptionEditableLabel
      label="Malé"
      disabled={false}
      onSave={onSave}
    />,
  );
  const input = screen.getByRole("textbox") as HTMLInputElement;
  return { input, onSave };
}

describe("ContactOptionEditableLabel", () => {
  it("is named after the option it renames", () => {
    const { input } = setup();
    expect(input.getAttribute("aria-label")).toBe(
      "settings:workspaceContacts.renameAria:Malé",
    );
  });

  it("saves the trimmed name on Enter", () => {
    const { input, onSave } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: "  Capital " } });
    // Enter hands focus away, which is what saves (once).
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Capital");
  });

  it("saves when focus leaves the field", () => {
    const { input, onSave } = setup();
    fireEvent.change(input, { target: { value: "Capital" } });
    fireEvent.blur(input);

    expect(onSave).toHaveBeenCalledWith("Capital");
  });

  it("puts the old name back on Escape without saving", () => {
    const { input, onSave } = setup();
    input.focus();
    fireEvent.change(input, { target: { value: "Capital" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(input.value).toBe("Malé");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not save an unchanged or blank name", () => {
    const { input, onSave } = setup();
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
    expect(input.value).toBe("Malé");
  });

  it("restores the old name when saving fails", async () => {
    const { input } = setup(vi.fn().mockRejectedValue(new Error("taken")));
    fireEvent.change(input, { target: { value: "Partner" } });
    fireEvent.blur(input);

    await vi.waitFor(() => expect(input.value).toBe("Malé"));
  });
});
