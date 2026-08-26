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
  type BrandPalette,
  contrastingForeground,
  DEFAULT_PALETTE,
  resolvePalette,
} from "@/lib/brand-colors";

export type Branding = {
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  backgroundColor: string;
  foregroundColor: string;
  cardColor: string;
  mutedColor: string;
  borderColor: string;
  sidebarBackgroundColor: string;
  sidebarForegroundColor: string;
  setupCompleted: boolean;
};

const DEFAULT_BRANDING: Branding = {
  displayName: "ElseTasks",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  ...DEFAULT_PALETTE,
  accentColor: DEFAULT_PALETTE.accentColor,
  setupCompleted: false,
};

type BrandingContextValue = {
  branding: Branding;
  refresh: () => Promise<void>;
  setBrandingLocal: (next: Partial<Branding>) => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function applyCssVars(branding: Branding) {
  const root = document.documentElement;
  const palette = resolvePalette(branding);
  const primaryFg = contrastingForeground(palette.primaryColor);

  root.style.setProperty("--brand-primary", palette.primaryColor);
  root.style.setProperty("--brand-accent", palette.accentColor);
  root.style.setProperty("--primary", palette.primaryColor);
  root.style.setProperty("--primary-foreground", primaryFg);
  root.style.setProperty("--ring", palette.primaryColor);
  root.style.setProperty("--sidebar-ring", palette.primaryColor);
  root.style.setProperty("--sidebar-primary", palette.primaryColor);
  root.style.setProperty("--sidebar-primary-foreground", primaryFg);

  root.style.setProperty("--background", palette.backgroundColor);
  root.style.setProperty("--foreground", palette.foregroundColor);
  root.style.setProperty("--card", palette.cardColor);
  root.style.setProperty("--card-foreground", palette.foregroundColor);
  root.style.setProperty("--popover", palette.cardColor);
  root.style.setProperty("--popover-foreground", palette.foregroundColor);
  root.style.setProperty("--muted", palette.mutedColor);
  root.style.setProperty("--muted-foreground", palette.sidebarForegroundColor);
  root.style.setProperty("--secondary", palette.mutedColor);
  root.style.setProperty("--secondary-foreground", palette.foregroundColor);
  root.style.setProperty("--accent", palette.mutedColor);
  root.style.setProperty("--accent-foreground", palette.foregroundColor);
  root.style.setProperty("--border", palette.borderColor);
  root.style.setProperty("--input", palette.borderColor);
  root.style.setProperty("--sidebar", palette.sidebarBackgroundColor);
  root.style.setProperty(
    "--sidebar-foreground",
    palette.sidebarForegroundColor,
  );
  root.style.setProperty("--sidebar-border", palette.borderColor);
  root.style.setProperty("--sidebar-accent", palette.mutedColor);
  root.style.setProperty(
    "--sidebar-accent-foreground",
    palette.foregroundColor,
  );

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
  raw: Partial<Branding> & { displayName?: string },
): Branding {
  const palette = resolvePalette(raw as Partial<BrandPalette>);
  return {
    displayName: raw.displayName || DEFAULT_BRANDING.displayName,
    logoUrl: raw.logoUrl ?? null,
    logoDarkUrl: raw.logoDarkUrl ?? null,
    faviconUrl: raw.faviconUrl ?? null,
    ...palette,
    accentColor: palette.accentColor,
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
    applyCssVars(next);
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
            applyCssVars(next);
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
