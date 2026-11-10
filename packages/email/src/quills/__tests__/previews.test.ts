import { createElement, type ComponentType } from "react";
import { render } from "@react-email/components";
import { describe, expect, it } from "vite-plus/test";
import { themeCss } from "../../components/theme";

type Preview = ComponentType & { PreviewProps?: Record<string, unknown> };
const previews = import.meta.glob<{ default: Preview }>(
  "../../../previews/**/*.tsx",
);
const originals = import.meta.glob("../../templates/*.tsx");
const quills = import.meta.glob("../templates/*.tsx");

describe("email preview catalog", () => {
  it("includes every email template in both packages", () => {
    const expected = [
      ...Object.keys(originals).map(
        (path) => "kaneo/" + path.split("/").at(-1),
      ),
      ...Object.keys(quills)
        .filter(
          (path) =>
            !path.endsWith("/email-layout.tsx") &&
            !path.endsWith("/line-breaks.tsx"),
        )
        .map((path) => "quills/" + path.split("/").at(-1)),
    ].sort();
    expect(
      Object.keys(previews)
        .map((path) => path.split("/previews/")[1])
        .sort(),
    ).toEqual(expected);
  });

  for (const [path, load] of Object.entries(previews)) {
    it(`renders ${path} with complete sample data`, async () => {
      const { default: Email } = await load();
      const html = await render(createElement(Email, Email.PreviewProps));
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
      expect(html).toContain(themeCss);
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("[object Object]");
      expect(html).not.toMatch(/href=["'](?:undefined|null|)["']/);
    });
  }
});
