import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { MyTasksPagination } from "./my-tasks-pagination";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(cleanup);

it("shows a retry action after failure and disables it while loading", () => {
  const onLoadMore = vi.fn();
  const { rerender } = render(
    <MyTasksPagination hasMore loading={false} error onLoadMore={onLoadMore} />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "workspace:myWork.loadError",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "common:error.tryAgain" }),
  );
  expect(onLoadMore).toHaveBeenCalledOnce();
  rerender(
    <MyTasksPagination hasMore loading error={false} onLoadMore={onLoadMore} />,
  );
  expect(screen.getByRole("button")).toBeDisabled();
  rerender(
    <MyTasksPagination
      hasMore={false}
      loading={false}
      error={false}
      onLoadMore={onLoadMore}
    />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
