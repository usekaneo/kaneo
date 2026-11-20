import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ColumnBackdropSlider } from "./column-backdrop-slider";

afterEach(cleanup);

function renderSlider(value: number, onChange = vi.fn()) {
  render(
    <ColumnBackdropSlider
      label="Column blur"
      resetLabel="Reset column blur to default"
      value={value}
      defaultValue={6}
      max={24}
      step={1}
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("ColumnBackdropSlider", () => {
  it("disables the reset button at the default value", () => {
    renderSlider(6);
    expect(
      screen.getByRole("button", { name: "Reset column blur to default" }),
    ).toBeDisabled();
  });

  it("resets a changed value to the default", () => {
    const onChange = renderSlider(14);
    const reset = screen.getByRole("button", {
      name: "Reset column blur to default",
    });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith(6);
  });
});
