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
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from "@/lib/brand-colors";

export type Branding = {
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  setupCompleted: boolean;
};

const DEFAULT_BRANDING: Branding = {
  displayName: "ElseTasks",
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  accentColor: DEFAULT_ACCENT_COLOR,
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
  const primary = branding.primaryColor || DEFAULT_PRIMARY_COLOR;
  const accent = branding.accentColor || DEFAULT_ACCENT_COLOR;

  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-accent", accent);
  // Brand primary drives interactive chrome (buttons, links, progress).
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-ring", primary);
  // Keep active sidebar affordances aligned with the brand without
  // rewriting the full sidebar surface palette.
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", "#FAFAFA");

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

async function fetchBranding(): Promise<Branding> {
  try {
    const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
    const response = await fetch(`${baseUrl}/branding`, {
      credentials: "include",
    });
    if (!response.ok) {
      return DEFAULT_BRANDING;
    }
    return response.json();
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
            const next = { ...prev, ...partial };
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
