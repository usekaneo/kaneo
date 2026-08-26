import { resolveApiBaseUrl } from "@kaneo/libs";
import type { Branding } from "@/hooks/use-branding";

export type UpdateBrandingInput = Partial<{
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
}>;

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
