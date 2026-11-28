import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { REPOSITORY_PROVIDERS } from "../automations/repository-providers";
import { INTEGRATIONS } from "./integration-definitions";

afterEach(cleanup);

describe("Tangled provider icon", () => {
  it.each([
    ["integration", INTEGRATIONS],
    ["workflow", REPOSITORY_PROVIDERS],
  ])("renders the official mark in the %s card", (_name, providers) => {
    const provider = providers.find((item) => item.id === "tangled");
    expect(provider).toBeDefined();
    const Icon = provider!.icon;
    const { container } = render(<Icon className="test-icon" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 23.6672 22.5402");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("test-icon");
  });
});
