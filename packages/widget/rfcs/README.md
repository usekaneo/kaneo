# Widget backend RFCs

Status: **Proposed — not implemented**. These documents turn the connected widget mock into an implementation plan. They do not claim that this checkout has a widget API, iframe application, authentication flow, database tables, or live message delivery.

The completed frontend is `src/ui/WidgetView.tsx` and its public contracts are in `src/ui/types.ts`. `stories/mock-backend.ts` is an in-memory demonstration, not a server or an authorization boundary. Its tests specify useful behavior, not production security.

Use the [Widget definition of done](DEFINITION_OF_DONE.md) for the complete visitor-to-team journey, required evidence, browser/device matrix, and release-readiness sign-off. Mock-only checks do not satisfy those integration gates.

Implement in this order:

1. [Session, iframe application, and data adapter](0001-session-and-adapter.md): authenticated tenant/visitor context, safe snapshot loading, existing protocol integration.
2. [Conversations and reliable writes](0002-conversations-and-delivery.md): durable messages, idempotency, read watermarks, realtime/reconnect.
3. [Feedback, discussions, roadmap, updates, and help content](0003-feedback-and-content.md): votes/follows, content visibility, published help, notifications and availability.

4. [Images and screenshot attachments](0004-images-and-capture.md): authorized upload sessions, image processing, durable attachment linking, quotas, and cleanup.
5. [Activity and article feedback](0005-activity-and-article-feedback.md): followed-request events/read state, private helpfulness responses, and verified article context on conversations.

The routes and table names below are proposed contracts. Before implementation, map them to existing API controllers, authentication, ID types, permission vocabulary, events, and migrations; reuse existing equivalents. Keep the public SDK commands, package names, deep links, and `quackback:*` bridge compatible. Root/version/browser entries must remain independent of React.

Each RFC includes acceptance gates. Complete those gates against a real local API and database before claiming backend integration. Then verify an independently hosted host page and iframe, both same-origin and separate-origin deployments, and the repository's normal test discovery. No managed service or Redis may be required for a single self-hosted instance.

Outside this set: AI replies, session replay, cross-device draft storage, and a new provider/state-management framework. The mock intentionally loses its data on remount. Real durability and access control belong to the API.
