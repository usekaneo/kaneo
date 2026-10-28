import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { AutoLoginRedirect } from "./auto-login-redirect";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("offers a manual link only after the redirect has had time to start", () => {
  vi.useFakeTimers();
  const onContinue = vi.fn();
  render(
    <AutoLoginRedirect providerName="Authentik" onContinue={onContinue} />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "auth:signIn.autoLogin.opening",
  );
  expect(
    screen.queryByRole("button", { name: "auth:signIn.autoLogin.continue" }),
  ).toBeNull();

  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(
    screen.getByRole("button", { name: "auth:signIn.autoLogin.continue" }),
  );
  expect(onContinue).toHaveBeenCalledTimes(1);
});
