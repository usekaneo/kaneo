# RFC 0004: Images, screenshots, and attachment storage

Status: **Proposed — backend not implemented**. Depends on RFCs 0001–0003. The current frontend selects images, captures with user permission, edits a local canvas, and passes Files to callbacks. Storybook keeps blob URLs only in memory; that is not an upload service.

## Contract and flow

Reuse existing upload/storage facilities after inspecting their tenant authorization and self-hosted deployment requirements. Do not introduce a required managed storage service. Support local storage and the repository's existing optional object storage adapter.

1. An authenticated instance/visitor adapter creates an upload session for an explicit purpose: conversation message or public feedback request. Proposed `POST /api/widget/uploads` accepts filename, byte length, MIME, and a digest. Authorize the target conversation/board before issuing a bounded, short-lived upload token. A public feedback attachment and a private conversation attachment have different access rules.
2. Upload bytes to the authorized endpoint. Validate the actual decoded format, dimensions, decompressed size, MIME, extension, and byte length. Current client limits are four images per submission, five MiB each, PNG/JPEG/WebP only. Server limits are authoritative. Reject SVG/HTML/polyglots, corrupt images, image bombs, and unsupported formats. Re-encode and strip metadata; apply the deployment's malware/quarantine policy. Never trust client signature checks or a filename.
3. The adapter receives an opaque attachment ID in a ready state, then submits the message/request with those IDs and the draft's idempotency key. In one transaction, verify ownership, purpose, readiness, expiration, and attachment count; link attachments and save the message plus receipt. A repeated key with different text or attachment content conflicts. A lost response returns the original record. Never retry a send with a fresh key automatically.
4. Project authorized `{id, name, url}` records into `FeedbackPost.attachments` or `Conversation.messages[].attachments`. Private reads require current session authorization or a short-lived scoped URL. Set correct content type, `X-Content-Type-Options: nosniff`, and safe content disposition. Do not leak private URLs in logs, public events, analytics, or error messages. Filenames are display text, never filesystem paths.

The adapter resolves submission callbacks only after persistence and prop refresh. Preserve original Files and draft on failure. Reuse completed upload sessions on retry; revoke abandoned sessions on identity change when possible. If upload progress/cancel UI is needed for slower networks, add it to this adapter flow before deployment rather than pretending the current local preview supplies server progress.

Picker, clipboard-image paste, and file drop share the same client validation, preview, edit/remove, count limits, and retry payload. Clipboard/drop listeners are scoped to the active composer, never the host document; ordinary text paste remains native. Cancel pending validation on navigation/close. These paths still require full server decoding and authorization above. Delivered attachments open in a native in-widget dialog with previous/next, zoom, keyboard scrolling, Escape and focus return. The viewer accepts the same safe HTTP(S)/local blob URLs, does not request extra capture/clipboard permissions, and does not make a private URL public. Expired or failed image loads show an error; the production adapter owns URL renewal.

## Capture and editing

Capture is initiated by the visitor. The browser chooses the surface and asks for permission each time; see the [W3C Screen Capture specification](https://www.w3.org/TR/screen-capture/). Do not capture on init, consent changes, navigation, or background retries. Do not enable audio. Stop tracks on all completion/error/abort paths, including a chooser that resolves after the view has unmounted.

Cross-origin capture delegation must be explicit in the host's Permissions Policy and iframe allow configuration. Offer file selection when capture is unsupported or denied. The current SDK does not automatically broaden iframe permissions. Keep host callbacks cancellable; if a new bridge is unavoidable, design and validate its origin, source, request identity, bounds, and cancellation protocol first.

The UI's redaction burns opaque pixels into the exported PNG. Upload only that edited output when the visitor chooses Use image, never the original source as a hidden companion. Metadata stripping still belongs to server processing. Provide a clear warning that unmarked information remains visible. No screen replay or automatic host-page capture is part of this feature.

## Quotas, cleanup, and durability

Apply per-instance and per-visitor byte/rate quotas, with bounded concurrency and backpressure. Use unguessable storage keys; reject path traversal and cross-instance attachment reuse. Expire unattached sessions, delete orphaned objects, and coordinate deletion with linked-message retention and backups. A worker restart must not lose the linkage or duplicate uploads. Redis remains optional. Describe backup/restore and disk-full behavior for local self-hosted storage.

## Acceptance gates

- API/database: foreign visitor/instance/board/conversation; expired/replayed token; private image URL access; corrupt/MIME-mismatched/oversized image; SVG/polyglot; oversized dimensions; quota/disk-full; filename traversal; duplicate concurrent writes; altered payload under the same idempotency key.
- Storage: only edited bytes are persisted; metadata is stripped; quarantined images are not served; aborted uploads and expired sessions are cleaned; transaction rollback never leaves public orphan data; backup/restore preserves authorized links.
- Browser: real browser chooser accept/cancel in supported desktop browsers; capture denied by policy; unsupported mobile fallback; navigation while chooser/upload pending; picker, preview, edit, redact, Undo, cancel, remove, retry after lost response, keyboard-only editing, and session isolation. Verify actual mobile keyboard/safe areas on hardware before release.
- Integration: same-origin and separately hosted iframe/host, real local API/storage, migrations, OpenAPI, normal test discovery, and affected consumer checks. The mock and an injected canvas stream do not prove OS permission UI, durable upload, or live delivery.
