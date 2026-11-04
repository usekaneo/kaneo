import { Readable } from "node:stream";
import { DefaultAzureCredential } from "@azure/identity";
import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
} from "@azure/storage-blob";
import { z } from "zod";
import { describeStorageError } from "./describe-storage-error";

const MILLISECONDS_PER_SECOND = 1000;
const CLOCK_SKEW_SECONDS = 60;

const azureConfigSchema = z.object({
  accountUrl: z.url({ protocol: /^https$/ }).refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  }, "AZURE_STORAGE_ACCOUNT_URL must be an HTTPS origin without credentials"),
  container: z.string().regex(/^(?!.*--)[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
});

export type AzureStorageConfig = z.infer<typeof azureConfigSchema>;

export function readAzureStorageConfig(): AzureStorageConfig {
  return azureConfigSchema.parse({
    accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL?.trim(),
    container: process.env.AZURE_STORAGE_CONTAINER?.trim(),
  });
}

let cached: { key: string; storage: AzureBlobStorage } | undefined;

export function azureStorage(config: AzureStorageConfig) {
  const key = JSON.stringify(config);
  if (cached?.key !== key) {
    cached = {
      key,
      storage: new AzureBlobStorage(
        new BlobServiceClient(config.accountUrl, new DefaultAzureCredential()),
        config.container,
      ),
    };
  }
  return cached.storage;
}

export class AzureBlobStorage {
  constructor(
    private readonly service: BlobServiceClient,
    private readonly container: string,
  ) {}

  private blob(key: string) {
    return this.service
      .getContainerClient(this.container)
      .getBlockBlobClient(key);
  }

  private async request<Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> {
    try {
      return await operation();
    } catch (error) {
      // SDK errors can contain the signed copy URL or authorization headers.
      const details = describeStorageError(error);
      throw Object.assign(new Error("Azure Blob Storage request failed."), {
        name: "AzureBlobStorageError",
        statusCode: details.status,
        code: details.code,
      });
    }
  }

  private async signedUrl(
    key: string,
    permissions: string,
    ttlSeconds: number,
  ) {
    const expiresOn = new Date(
      Date.now() + ttlSeconds * MILLISECONDS_PER_SECOND,
    );
    const startsOn = new Date(
      Date.now() - CLOCK_SKEW_SECONDS * MILLISECONDS_PER_SECOND,
    );
    const delegation = await this.service.getUserDelegationKey(
      startsOn,
      expiresOn,
    );
    return this.blob(key).generateUserDelegationSasUrl(
      {
        permissions: BlobSASPermissions.parse(permissions),
        protocol: SASProtocol.Https,
        startsOn,
        expiresOn,
      },
      delegation,
    );
  }

  async uploadUrl(key: string, contentType: string, ttlSeconds: number) {
    return this.request(async () => ({
      // Create-only prevents a still-valid upload URL from replacing a finalized file.
      uploadUrl: await this.signedUrl(key, "c", ttlSeconds),
      headers: { "Content-Type": contentType, "x-ms-blob-type": "BlockBlob" },
    }));
  }

  async head(key: string, abortSignal: AbortSignal) {
    return this.request(async () => {
      const properties = await this.blob(key).getProperties({ abortSignal });
      return {
        ContentLength: properties.contentLength,
        ContentType: properties.contentType,
      };
    });
  }

  async download(key: string) {
    return this.request(async () => {
      const response = await this.blob(key).download();
      if (!response.readableStreamBody)
        throw new Error("Storage object body is missing.");
      return {
        body: Readable.toWeb(Readable.from(response.readableStreamBody)),
        contentType: response.contentType,
        contentLength: response.contentLength,
        etag: response.etag,
        lastModified: response.lastModified,
      };
    });
  }

  async copy(sourceKey: string, destinationKey: string, ttlSeconds: number) {
    return this.request(async () => {
      const source = await this.signedUrl(sourceKey, "r", ttlSeconds);
      await this.blob(destinationKey).syncUploadFromURL(source, {
        conditions: { ifNoneMatch: "*" },
      });
    });
  }

  async delete(key: string, abortSignal?: AbortSignal) {
    await this.request(() => this.blob(key).deleteIfExists({ abortSignal }));
  }

  async probe(abortSignal: AbortSignal) {
    await this.request(() =>
      this.service
        .getContainerClient(this.container)
        .getProperties({ abortSignal }),
    );
  }
}
