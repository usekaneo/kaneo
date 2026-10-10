import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

afterEach(cleanup);

it("does not animate anchor coordinates", async () => {
  render(
    <Popover defaultOpen>
      <PopoverTrigger>Open editor</PopoverTrigger>
      <PopoverContent>Editor</PopoverContent>
    </Popover>,
  );

  const popup = await screen.findByRole("dialog");
  const positioner = popup.closest('[data-slot="popover-positioner"]');
  expect(positioner).not.toBeNull();
  expect(positioner?.className).not.toMatch(
    /transition-\[[^\]]*(top|left|right|bottom|transform)/,
  );
});
