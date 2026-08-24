export function VersionDisplay() {
  const version = __APP_VERSION__;

  return (
    <div className="flex items-center justify-center px-2 py-1.5">
      <span className="text-xs text-muted-foreground">v{version}</span>
    </div>
  );
}
