export type ApiKey = {
  id: string;
  name: string | null;
  prefix: string | null;
  start: string | null;
  enabled: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  permissions: Record<string, string[]> | null;
  userId: string;
  refillInterval: number | null;
  refillAmount: number | null;
  lastRefillAt: Date | null;
  rateLimitEnabled: boolean;
  rateLimitTimeWindow: number | null;
  rateLimitMax: number | null;
  requestCount: number;
  remaining: number | null;
  lastRequest: Date | null;
  updatedAt: Date;
  metadata: any;
};

export type CreateApiKeyRequest = {
  name?: string;
  expiresIn?: number;
  prefix?: string;
  metadata?: any;
};

export type CreateApiKeyResponse = ApiKey & {
  key: string; // Full key, only shown once
};

