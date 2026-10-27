const DEFAULT_BRAND = "Kaneo";

let resolveName: () => Promise<string | null | undefined> = async () => null;
let current = DEFAULT_BRAND;

/** Let the API supply the instance name shown in email headers and subjects. */
export function setBrandNameResolver(
  resolver: () => Promise<string | null | undefined>,
) {
  resolveName = resolver;
}

/** Refresh the instance name before an email is rendered. */
export async function loadBrandName() {
  try {
    current = (await resolveName())?.trim() || DEFAULT_BRAND;
  } catch {
    // Keep the last known name when settings can't be read.
  }
}

export function brandName() {
  return current;
}

export function brandSubject(subject: string) {
  return current === DEFAULT_BRAND
    ? subject
    : subject.replaceAll(DEFAULT_BRAND, current);
}
