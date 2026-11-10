/** Apply browser privacy signals before accessing device identity or sending analytics. */
export function privacyOptedOut(): boolean {
  return (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}
