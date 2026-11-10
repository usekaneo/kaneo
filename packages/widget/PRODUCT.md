# Widget

An embeddable support and feedback SDK with a separate, optional React presentation entry. Visitors can browse help, feedback, and updates, and send messages or ideas through actions supplied by the host.

The user requested Storybook and a visual match to UserJot's live widget. The scoped interpretation is all five widget screens with Quills branding, plus the existing launcher and panel. This package has no application backend or iframe route; Storybook uses clearly marked, local demo data.

Preserve the SDK's commands, events, deep links, identity, consent, and iframe protocol. Keep React optional and analytics off in demos. No app integration, new provider, authentication implementation, publishing, or release is part of this work.

The enhanced presentation supports session drafts and Back navigation, loading/recovery/offline states, conversation replies and read markers, vote/follow reversal and status filters, a contextual home, ranked help search, rich text blocks, and composer suggestions. A local async mock exercises these flows, including lost-response retries, without sending data out of Storybook.

Success means a working local preview at desktop and mobile sizes, safe async submissions, identity isolation, keyboard close and reopen, a clean package build, and unchanged SDK contract tests. `rfcs/` describes the remaining real backend work. Drafts survive navigation and close/reopen only while the same keyed view remains mounted; durable drafts, AI, and session replay are outside this scope.

The eight user-supplied screenshots extend this scope to expanded help/update readers, request discussions with nested replies and votes, grouped roadmap rails, bottom-aligned new conversations, and image/screenshot feedback. Image selection, capture, highlight/redaction, preview, removal, and mock submission are local; durable upload services are specified in RFC 0004. Existing public SDK commands and event names remain unchanged.

The next enhancement set adds composer-scoped image paste/drop, private followed-request activity with explicit read acknowledgment, conversation reading-position controls and keyboard send, an internal image viewer, and helpfulness feedback with article-context conversations. All server actions remain mocked; RFC 0005 defines durable activity, helpfulness, and verified context. No availability/contact-capture feature, AI, replay, or localization is added.
