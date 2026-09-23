import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getPublicProjectDescription } from "@/fetchers/task/get-description-pages";
import { PublicProjectDescription } from "./project-description";

vi.mock("@/fetchers/task/get-description-pages", () => ({
  getPublicProjectDescription: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("loads deferred project text, with an explicit retry after failure", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.mocked(getPublicProjectDescription)
    .mockRejectedValueOnce(new Error("changed"))
    .mockResolvedValueOnce("Full project description");
  render(
    <QueryClientProvider client={client}>
      <PublicProjectDescription
        project={{
          id: "project",
          description: null,
          descriptionDeferred: true,
        }}
      />
    </QueryClientProvider>,
  );
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("tasks:descriptionRetry"));
  expect(await screen.findByText("Full project description")).toBeTruthy();
  client.clear();
});
it("keeps ordinary project descriptions immediate", () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <PublicProjectDescription
        project={{ id: "project", description: "Small description" }}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText("Small description")).toBeTruthy();
  expect(getPublicProjectDescription).not.toHaveBeenCalled();
  client.clear();
});
