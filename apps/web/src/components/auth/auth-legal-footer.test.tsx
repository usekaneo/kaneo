import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { AuthLegalFooter } from "./auth-legal-footer";

const config = vi.hoisted(() => ({
  value: undefined as { isCloud: boolean; instanceName: string } | undefined,
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: config.value }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("AuthLegalFooter", () => {
  it("links to this operator's policies on a self-hosted instance", () => {
    config.value = { isCloud: false, instanceName: "Quills" };
    const html = renderToStaticMarkup(<AuthLegalFooter />);
    expect(html).toContain('href="/terms/"');
    expect(html).toContain('href="/privacy/"');
    expect(html).toContain(">Quills</a>");
    expect(html).not.toContain("kaneo.app");
  });

  it("waits for the instance name before rendering", () => {
    config.value = undefined;
    expect(renderToStaticMarkup(<AuthLegalFooter />)).toBe("");
  });
});
