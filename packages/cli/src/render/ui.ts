import type { Capabilities } from "./capabilities.js";
import { type Glyphs, glyphsFor } from "./glyphs.js";
import { makeTheme, type Theme } from "./theme.js";

export type Ui = {
  readonly caps: Capabilities;
  readonly theme: Theme;
  readonly glyphs: Glyphs;
};

export function makeUi(caps: Capabilities): Ui {
  return {
    caps,
    theme: makeTheme(caps.color),
    glyphs: glyphsFor(caps.unicode),
  };
}
