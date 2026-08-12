import { resolveApiBaseUrl } from "@kaneo/libs";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  primaryColor: "#0F766E",
  accentColor: null,
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
  root.style.setProperty("--brand-primary", branding.primaryColor);
  root.style.setProperty("--primary", branding.primaryColor);
  if (branding.accentColor) {
    root.style.setProperty("--brand-accent", branding.accentColor);
  }
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
  const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
  const response = await fetch(`${baseUrl}/branding`, {
    credentials: "include",
  });
  if (!response.ok) {
    return DEFAULT_BRANDING;
  }
  return response.json();
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
