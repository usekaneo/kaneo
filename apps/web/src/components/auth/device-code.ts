export function normalizeDeviceCode(code: string | undefined) {
  return code?.trim().replace(/[\s-]/g, "").toUpperCase() ?? "";
}

export function formatDeviceCode(code: string) {
  if (code.length < 6 || code.length % 2 !== 0) return code;
  const middle = code.length / 2;
  return `${code.slice(0, middle)}-${code.slice(middle)}`;
}
