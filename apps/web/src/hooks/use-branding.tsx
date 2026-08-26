import { resolveApiBaseUrl } from "@kaneo/libs";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  applyThemePaletteStyles,
  type BrandPalette,
  DEFAULT_THEME_PALETTES,
  resolveDarkPalette,
  resolveLightPalette,
  resolveThemePalettes,
  type ThemePalettes,
} from "@/lib/brand-colors";

export type Branding = {
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  paletteDark: BrandPalette;
  paletteLight: BrandPalette;
  setupCompleted: boolean;
};

const DEFAULT_BRANDING: Branding = {
  displayName: "ElseTasks",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  paletteDark: DEFAULT_THEME_PALETTES.dark,
  paletteLight: DEFAULT_THEME_PALETTES.light,
  setupCompleted: false,
};

type BrandingContextValue = {
  branding: Branding;
  refresh: () => Promise<void>;
  setBrandingLocal: (next: Partial<Branding> & Partial<ThemePalettes>) => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function applyBrandingEffects(branding: Branding) {
  applyThemePaletteStyles({
    light: branding.paletteLight,
    dark: branding.paletteDark,
  });

  if (branding.faviconUrl) {
    const link =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ||
      document.createElement("link");
    link.rel = "icon";
    link.href = branding.faviconUrl;
    if (!link.parentElement) {
      document.head.appendChild(link);
    }
  }
  document.title = document.title.replace(
    /ElseTasks|Kaneo/g,
    branding.displayName,
  );
}

function normalizeBranding(
  raw: Partial<Branding> & {
    displayName?: string;
    paletteLight?: Partial<BrandPalette> | null;
    primaryColor?: string;
    accentColor?: string | null;
    backgroundColor?: string;
    foregroundColor?: string;
    cardColor?: string;
    mutedColor?: string;
    borderColor?: string;
    sidebarBackgroundColor?: string;
    sidebarForegroundColor?: string;
  },
): Branding {
  const paletteDark = resolveDarkPalette({
    ...(raw.paletteDark ?? {}),
    primaryColor: raw.primaryColor ?? raw.paletteDark?.primaryColor,
    accentColor: raw.accentColor ?? raw.paletteDark?.accentColor,
    backgroundColor: raw.backgroundColor ?? raw.paletteDark?.backgroundColor,
    foregroundColor: raw.foregroundColor ?? raw.paletteDark?.foregroundColor,
    cardColor: raw.cardColor ?? raw.paletteDark?.cardColor,
    mutedColor: raw.mutedColor ?? raw.paletteDark?.mutedColor,
    borderColor: raw.borderColor ?? raw.paletteDark?.borderColor,
    sidebarBackgroundColor:
      raw.sidebarBackgroundColor ?? raw.paletteDark?.sidebarBackgroundColor,
    sidebarForegroundColor:
      raw.sidebarForegroundColor ?? raw.paletteDark?.sidebarForegroundColor,
  });

  const paletteLight = resolveLightPalette(
    raw.paletteLight ?? undefined,
    paletteDark,
  );

  return {
    displayName: raw.displayName || DEFAULT_BRANDING.displayName,
    logoUrl: raw.logoUrl ?? null,
    logoDarkUrl: raw.logoDarkUrl ?? null,
    faviconUrl: raw.faviconUrl ?? null,
    paletteDark,
    paletteLight,
    setupCompleted: raw.setupCompleted ?? false,
  };
}

async function fetchBranding(): Promise<Branding> {
  try {
    const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
    const response = await fetch(`${baseUrl}/branding`, {
      credentials: "include",
    });
    if (!response.ok) {
      return DEFAULT_BRANDING;
    }
    return normalizeBranding(await response.json());
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

  const refresh = useCallback(async () => {
    const next = await fetchBranding();
    setBranding(next);
    applyBrandingEffects(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BrandingContext.Provider
      value={{
        branding,
        refresh,
        setBrandingLocal: (partial) => {
          setBranding((prev) => {
            const next = normalizeBranding({ ...prev, ...partial });
            applyBrandingEffects(next);
            return next;
          });
        },
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    throw new Error("useBranding must be used within BrandingProvider");
  }
  return ctx;
}

export { resolveThemePalettes };
