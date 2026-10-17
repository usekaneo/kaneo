import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { CheckoutSuccessCallout } from "./checkout-success-callout";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

it("thanks the subscriber and can be dismissed", () => {
  const onDismiss = vi.fn();
  render(<CheckoutSuccessCallout onDismiss={onDismiss} />);

  expect(
    screen
      .getByRole("status")
      .textContent?.includes("settings:billing.checkoutSuccess.title"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "common:actions.close" }));
  expect(onDismiss).toHaveBeenCalledOnce();
});
