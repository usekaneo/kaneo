import { cn } from "@/lib/cn";
import type { ColorPalette } from "@/store/color-palette";

type Swatch = {
  background: string;
  card: string;
  border: string;
  text: string;
  accent: string;
  primary: string;
};

// Fixed literals, not tokens: each option previews itself even while another
// palette is active (same reason ThemePreviewWindow avoids tokens).
const SWATCHES: Record<ColorPalette, Swatch> = {
  kaneo: {
    background: "#ffffff",
    card: "#ffffff",
    border: "#ebebeb",
    text: "#262626",
    accent: "#f5f5f5",
    primary: "#262626",
  },
  modern: {
    background: "#f9fafd",
    card: "#ffffff",
    border: "#e2e4e7",
    text: "#171b22",
    accent: "#eff0fa",
    primary: "#505ac8",
  },
};

type PaletteSwatchProps = {
  palette: ColorPalette;
  className?: string;
};

export function PaletteSwatch({ palette, className }: PaletteSwatchProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex items-center gap-1", className)}
    >
      {Object.entries(SWATCHES[palette]).map(([token, color]) => (
        <span
          key={token}
          className="size-3 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}
