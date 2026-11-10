export const brand: {
  name: string;
  publicUrl: string;
  clientUrl: string;
  docsUrl: string;
  supportUrl: string;
  assetsUrl: string;
  repositoryUrl: string;
  supportEmail: string;
  releaseApiUrl: string;
  imageBase: string;
  npmScope: string;
  mcpRegistryName: string;
  appStoreUrl: string | null;
  assets: Array<{
    source: string;
    target: string;
    sha256: string;
    approved: boolean;
  }>;
};
export function brandText(value: string): string;
export function brandResources<T>(value: T): T;
export function instanceName(value?: string | null): string;
export function assertReleaseBrand(): void;
export function assertPackageBrand(): void;
export function missingTranslation(key: string, defaultValue?: string): string;
export function brandAssetUrl(target: string): string | undefined;
