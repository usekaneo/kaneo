const localSignInPaths = new Set([
  "/sign-in/email",
  "/sign-in/magic-link",
  "/magic-link/verify",
  "/sign-in/email-otp",
]);

export function isLocalSignInPath(path: string) {
  return localSignInPaths.has(path) || path.startsWith("/email-otp/");
}
