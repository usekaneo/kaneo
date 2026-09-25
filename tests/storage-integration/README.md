# Local storage contract tests

These tests use a disposable S3-compatible service on `127.0.0.1` with the fixed, non-production credentials `local-test-access` / `local-test-secret-only`. They refuse remote endpoints, create a unique test bucket and delete only that bucket and its test objects afterwards. Never point them at an existing storage service.

Start a local MinIO test container bound to loopback with those root credentials:

```sh
docker run --rm -d --name kaneo-storage-contract-test \
  -p 127.0.0.1:59039:9000 \
  -e MINIO_ROOT_USER=local-test-access \
  -e MINIO_ROOT_PASSWORD=local-test-secret-only \
  -e MINIO_BROWSER=off -e MINIO_UPDATE=off \
  --entrypoint /opt/bitnami/minio/bin/minio \
  bitnamilegacy/minio@sha256:8935e75fa5d11295c17171e4aa49efe390a1193cd7f12e4d21b92af9ffef09d7 \
  server /tmp/minio --address :9000
```

Once the service is ready, run:

```sh
KANEO_STORAGE_TEST_ENDPOINT=http://127.0.0.1:59039 pnpm --filter @kaneo/api exec vitest run --config vitest.storage.config.ts
docker stop kaneo-storage-contract-test
```

The suite checks signed size/content-type enforcement, chunked-transfer rejection, actual object metadata, missing objects and oversized-object cleanup. The regular API integration suite separately covers endpoint authorization and database writes with mocked storage calls. No real cloud account or email provider is required.
