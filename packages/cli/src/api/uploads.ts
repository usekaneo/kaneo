import { Duration, Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { ServerError, ServerUnreachable } from "../errors/errors.js";
import { Session } from "../services/session.js";
import { KaneoApi } from "./kaneo-api.js";

export const TaskUpload = Schema.Struct({
  key: Schema.String,
  uploadUrl: Schema.String,
  headers: Schema.Record(Schema.String, Schema.String),
});
export type TaskUpload = typeof TaskUpload.Type;

export const StoredAsset = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
});
export type StoredAsset = typeof StoredAsset.Type;

export type UploadSurface = "description" | "comment";

export type UploadFile = {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
};

const STORAGE_TIMEOUT = Duration.minutes(2);

function uploadPath(taskId: string, suffix = ""): string {
  return `/api/task/image-upload/${encodeURIComponent(taskId)}${suffix}`;
}

function describe(file: UploadFile, surface: UploadSurface) {
  return {
    filename: file.name,
    contentType: file.contentType,
    size: file.bytes.byteLength,
    surface,
  };
}

const putToStorage = Effect.fnUntraced(function* (
  upload: TaskUpload,
  file: UploadFile,
) {
  const session = yield* Session;
  const client = yield* HttpClient.HttpClient;
  const target = new URL(upload.uploadUrl, `${session.apiUrl}/`);
  const request = HttpClientRequest.put(target).pipe(
    HttpClientRequest.bodyUint8Array(file.bytes, file.contentType),
    HttpClientRequest.setHeaders(upload.headers),
  );
  const response = yield* client.execute(request).pipe(
    Effect.timeout(STORAGE_TIMEOUT),
    Effect.mapError(
      (error) =>
        new ServerUnreachable({
          apiUrl: target.origin,
          reason:
            error._tag === "TimeoutError"
              ? "the upload timed out"
              : "the upload failed",
        }),
    ),
  );
  if (response.status < 200 || response.status >= 300) {
    return yield* new ServerError({
      status: response.status,
      message: `file storage rejected ${file.name}`,
    });
  }
});

export const uploadTaskFile = Effect.fnUntraced(function* (
  taskId: string,
  file: UploadFile,
  surface: UploadSurface,
) {
  const api = yield* KaneoApi;
  const details = describe(file, surface);
  const upload = yield* api.request("PUT", uploadPath(taskId), TaskUpload, {
    body: details,
  });
  yield* putToStorage(upload, file);
  return yield* api.request(
    "POST",
    uploadPath(taskId, "/finalize"),
    StoredAsset,
    { body: { key: upload.key, ...details } },
  );
});
