import type { ImportConnectValues } from "@/components/import/connect-values";

export type ConnectFormProps = {
  values: ImportConnectValues;
  onChange: (patch: Partial<ImportConnectValues>) => void;
  error: string | null;
  trelloAuthorizeUrl: string | null;
};
