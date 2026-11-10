import { instanceName, brandText } from "@kaneo/branding";
const DEFAULT_BRAND = brandText("Kaneo");

let resolveName: () => Promise<string | null | undefined> = async () => null;

/** Let the API supply the instance name shown in email headers and subjects. */
export function setBrandNameResolver(
  resolver: () => Promise<string | null | undefined>,
) {
  resolveName = resolver;
}

/** Take one immutable branding snapshot for an outgoing email. */
export async function loadBrandName() {
  try {
    return instanceName(await resolveName());
  } catch {
    return DEFAULT_BRAND;
  }
}

export type EmailSubject = string | ((instanceName: string) => string);
