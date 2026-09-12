declare module "creem/webhooks.js" {
  export class WebhookVerificationError extends Error {}

  export function constructWebhookEvent<TData = unknown>(
    payload: string | ArrayBuffer | Uint8Array,
    headers: Record<string, string | string[] | undefined>,
    options: string | { secret: string },
  ): Promise<{
    id?: string;
    type: string;
    data: TData;
    createdAt?: number;
  }>;
}
