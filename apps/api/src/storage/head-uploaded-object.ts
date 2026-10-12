import {
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  type S3Client,
} from "@aws-sdk/client-s3";

export const UPLOAD_VISIBILITY_RETRY_DELAYS_MS = [250, 500, 1000, 2000, 4000];

function storageStatus(error: unknown) {
  return error instanceof Error && "$metadata" in error
    ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
    : undefined;
}

export function isMissingObjectError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      storageStatus(error) === 404)
  );
}

export async function headUploadedObject(
  client: Pick<S3Client, "send">,
  bucket: string,
  key: string,
  abortSignal: AbortSignal,
): Promise<HeadObjectCommandOutput> {
  const head = () =>
    client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal,
    });
  for (const delay of UPLOAD_VISIBILITY_RETRY_DELAYS_MS) {
    try {
      return await head();
    } catch (error) {
      if (storageStatus(error) !== 403 || abortSignal.aborted) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return head();
}
