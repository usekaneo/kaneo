import { resolveApiBaseUrl } from "@kaneo/libs";
import type { Branding } from "@/hooks/use-branding";
import type { BrandPalette } from "@/lib/brand-colors";

export type UpdateBrandingInput = Partial<{
  displayName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  setupCompleted: boolean;
  paletteLight: Partial<BrandPalette> | null;
}> &
  Partial<BrandPalette>;

export async function updateBranding(
  input: UpdateBrandingInput,
): Promise<Branding> {
  const baseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_URL);
  const response = await fetch(`${baseUrl}/branding`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Failed to update branding (${response.status})`);
  }

  return response.json();
}
