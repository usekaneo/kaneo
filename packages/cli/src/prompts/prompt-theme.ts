import type { Prompt } from "effect/cli";
import { themeCodes } from "../render/theme.js";
import type { Ui } from "../render/ui.js";

export function promptTheme(ui: Ui): Partial<Prompt.Theme> {
  const codes = themeCodes(ui.caps.color);
  return {
    prefix: ui.glyphs.diamond,
    pointer: ui.caps.unicode ? "❯" : ">",
    tick: ui.glyphs.tick,
    ellipsis: ui.glyphs.ellipsis,
    primaryColor: codes.bold,
    mutedColor: codes.muted,
    successColor: codes.success,
    errorColor: codes.danger,
    submittedColor: "",
  };
}
