# @quackback/widget

The official SDK for embedding the [Quackback](https://quackback.io) feedback widget in your app. Ships with TypeScript types and a React adapter. Runtime boundary validation uses Zod (the browser bundle uses Zod Mini); this is not a zero-runtime-dependency package. React remains an optional peer dependency and is loaded only by the `/react` and `/ui` entries.

## Install

```bash
npm install @quackback/widget
# or:  pnpm add @quackback/widget
# or:  bun add @quackback/widget
```

## Vanilla JS

```js
import { Quackback } from '@quackback/widget'

Quackback.init({ instanceUrl: 'https://feedback.yourcompany.com' })

// When you know who the user is:
Quackback.identify({ id: 'u_123', email: 'ada@example.com', name: 'Ada' })

// Deep-link to a specific view:
Quackback.open({ view: 'new-post', title: 'Bug:', board: 'bugs' })
```

## React

```tsx
import { useQuackbackInit, useQuackback, useQuackbackEvent } from '@quackback/widget/react'

function App() {
  const { user } = useAuth()

  useQuackbackInit({
    instanceUrl: 'https://feedback.yourcompany.com',
    identity: user ? { id: user.id, email: user.email, name: user.name } : undefined,
  })

  useQuackbackEvent('post:created', (post) => {
    analytics.track('feedback_submitted', { postId: post.id })
  })

  return <Layout />
}

function FeedbackButton() {
  const qb = useQuackback()
  return <button onClick={() => qb.open({ view: 'new-post' })}>Feedback</button>
}
```

No provider needed — Quackback is a singleton and the hooks wrap its lifecycle. The root entry and React adapter share one SDK within ESM and within CommonJS. Use one `useQuackbackInit` owner per page.

Changing `identity` to `undefined` switches to anonymous mode. Delayed startup uses the latest options and does not send identity until initialization. Changing `instanceUrl`, `shouldInitialize`, or `initializeDelay` restarts that lifecycle; other options apply at the next initialization. Unmounting cancels pending startup and destroys the owned instance, including during React Strict Mode cleanup.

## Other frameworks

Vue, Svelte, Angular, Solid: import `Quackback` from the main entry and call it directly. Framework adapters ship on request.

## Prefer a script tag?

Drop this in your `<head>` and skip the install step entirely:

```html
<script src="https://feedback.yourcompany.com/api/widget/sdk.js" defer></script>
```

## API

### Methods

| Method                                        | Description                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `Quackback.init(options)`                     | Create launcher + iframe. `options.instanceUrl` required.                      |
| `Quackback.identify(identity?)`               | Attribute activity to a user. Omit for anonymous.                              |
| `Quackback.logout()`                          | Clear identity and close the panel; keep the launcher available.                        |
| `Quackback.open(options?)`                    | Open the panel; optional deep-link payload (see below).                        |
| `Quackback.close()`                           | Close the panel.                                                               |
| `Quackback.showLauncher()` / `hideLauncher()` | Toggle the floating button.                                                    |
| `Quackback.metadata(patch)`                   | Attach session context to submitted feedback. Pass `null` to remove a key.     |
| `Quackback.tracking(enabled)`                 | Allow or stop host-page visitor analytics. `false` also removes the device id. |
| `Quackback.on(event, handler)`                | Subscribe to a widget event. Returns an unsubscribe function.                  |
| `Quackback.off(event, handler?)`              | Remove a specific handler, or all listeners for the event.                     |
| `Quackback.destroy()`                         | Cancel owned work and remove widget DOM; preserve subscriptions and consent choice.                                            |
| `Quackback.isOpen()`                          | Whether the panel is currently visible.                                        |
| `Quackback.getUser()`                         | The current identified user, or `null`.                                        |
| `Quackback.isIdentified()`                    | `true` when a user is identified (non-anonymous).                              |

### `init` options

```ts
Quackback.init({
  instanceUrl: 'https://feedback.yourcompany.com', // required
  placement: 'right' | 'left', // default 'right'
  defaultBoard: 'bugs', // filter widget to one board
  launcher: true, // false = hide default button
  locale:
    'en' |
    'fr' |
    'de' |
    'es' |
    'ar' |
    'ru' |
    'pt-BR' |
    'zh-CN' |
    'zh-TW' |
    'nl' |
    'pl' |
    'th' |
    'uk', // override auto-detect
  identity: { id, email, name } | { ssoToken }, // bundle identify into init
  tracking: true, // false = no pageview beacons or new device id until tracking(true)
})
```

Theme colors and tab visibility come from your Quackback admin (Admin → Settings → Widget).

### Visitor analytics and consent

When the instance has visitor analytics on, the widget reports host-page views and may keep a device id in the host page's `localStorage`. If your site asks visitors for analytics consent, start with `tracking: false` and switch it on once they accept:

```ts
Quackback.init({ instanceUrl, tracking: false })
onAnalyticsConsent((granted) => Quackback.tracking(granted))
```

DNT (`doNotTrack === "1"`) and Global Privacy Control block device-ID access, creation, storage, and sending as well as pageview tracking. Browser signals are checked again when sending analytics. A host withdrawal survives destroy/re-init unless the host explicitly opts in again.

The launcher and panel work either way; only pageview tracking waits for consent. Withdrawing with `tracking(false)` stops future pageviews and removes the stored device id; visits the instance already recorded stay in its analytics.

### `identify` shapes

```ts
Quackback.identify() // anonymous
Quackback.identify({ id: 'u_123', email: 'ada@x.com', name: 'Ada' }) // unverified
Quackback.identify({ ssoToken: 'eyJ...' }) // verified
```

Before iframe readiness, only the latest identity is queued. Once ready, identify requests are serialized behind `quackback:identify-result`; while a newer identity waits, an old result cannot restore the previous user or emit an obsolete identify event. `getUser()` stays `null` until the latest request is confirmed. If the iframe never acknowledges a request, identity remains unconfirmed; the SDK does not guess which late response belongs to a later request.

See the [Identify users guide](https://quackback.io/docs/widget/identify-users) for JWT claims and server examples.

### `open` deep-links

```ts
Quackback.open() // home
Quackback.open({ view: 'new-post', title: 'Bug:', body: '...', board: 'bugs' }) // pre-filled form
Quackback.open({ view: 'changelog' }) // changelog feed
Quackback.open({ view: 'help', query: 'pricing' }) // help search
Quackback.open({ view: 'messages' }) // messenger conversations
Quackback.open({ view: 'tickets' }) // the visitor's tickets, or messages when unavailable
Quackback.open({ postId: 'post_01h...' }) // specific post
Quackback.open({ articleId: 'article_01h...' }) // help article TypeID or slug
```

`postId` and `articleId` win over `view` if both are set. `board` on `open` only applies to `view: 'new-post'`. Home / Popular Ideas filtering uses `init({ defaultBoard })` or the iframe `?board=` param.

Every `open` field is live. A disabled surface or an unseen board fails closed — the panel still opens, but the widget does not invent access.

### Events

```ts
const unsubscribe = Quackback.on('vote', (payload) => {
  console.log('Voted on', payload.postId)
})
unsubscribe()
```

| Event             | Payload                                    |
| ----------------- | ------------------------------------------ |
| `ready`           | `{}`                                       |
| `open`            | `{ view?, postId?, articleId?, entryId? }` |
| `close`           | `{}`                                       |
| `post:created`    | `{ id, title, board, statusId }`           |
| `vote`            | `{ postId, voted, voteCount }`             |
| `comment:created` | `{ postId, commentId, parentId }`          |
| `identify`        | `{ success, user, anonymous, error? }`     |
| `email-submitted` | `{ email }`                                |
| `unread`          | `{ count }` — a finite nonnegative integer  |

## Lifecycle and iframe boundaries

Invalid init options throw before replacing a working instance. A re-init or destroy aborts the config request and cancels or invalidates its reveal timers and idle preload callbacks. Failed or malformed server configuration falls back to empty configuration, leaving analytics off. Baked configuration tied to another instance is not reused.

Messages must come from both the configured origin and the current iframe window. Unknown message types, unknown event names, and malformed payloads are ignored. External navigation remains limited to HTTP(S), with `noopener,noreferrer`. The iframe protocol names and deep-link fields are unchanged.

Subscriptions belong to the caller and survive `destroy()` and re-init. Use the returned unsubscribe function or `off()` to remove them; `useQuackbackEvent` unsubscribes when its component unmounts.

The closed panel is inert. Opening moves focus into the iframe; closing restores the opener when it is still present. The launcher greeting is keyboard accessible, and host-side motion honors `prefers-reduced-motion`. Keyboard behavior inside the cross-origin iframe, including its close controls, is owned by the iframe application.

The default launcher is a white 40 px circle, 20 px from the edge; server theme colors still override it. The open panel hides the launcher and requests the existing `showClose=1` iframe option. A host-side close button remains available until the iframe sends `quackback:ready`. On desktop, the panel is 384 × 760 px, limited by the viewport, with 16 px edge spacing. At 760 px viewport width or below it fills the screen. Expansion, placement, greeting, label, and unread-count behavior remain supported.

## Optional React widget UI

The `@quackback/widget/ui` entry provides the widget's Home, Messages, Help, Feedback, and Updates screens. Its CSS values follow the [UserJot widget reference](https://userjot.com/in-app-feedback-widget), with Quills branding and official Phosphor icons. The header defaults to Quills and can use a host’s `brandName`; the footer always reads “Powered by Quills.” The package name and SDK protocol remain `@quackback/widget` and `quackback:*`. Import the stylesheet explicitly:

```tsx
import { WidgetView } from '@quackback/widget/ui'
import '@quackback/widget/ui/styles.css'

<WidgetView
  key={`${instanceId}:${visitorSessionId}`}
  onClose={closePanel}
  articles={articles}
  feedback={feedback}
  updates={updates}
  conversations={conversations}
  onSendMessage={sendMessage}
  onSubmitFeedback={submitFeedback}
  onReplyMessage={replyToConversation}
  onVoteFeedback={setVote}
  onFollowFeedback={setFollow}
/>
```

Give its parent a width and height; the view fills that space. `theme` accepts `light`, `dark`, or `auto` (the default), and `initialTab` selects the initial screen. Changing `initialTab` after mount does not reset navigation. Key the view by instance and visitor session, and replace private data immediately when either changes. This remount discards the old visitor's private drafts, pending UI completions, and navigation. The host adapter must also abort or ignore responses from the old session.

Drafts, search/category/status filters, sorting, and list scroll positions survive navigation within a mounted session. Keep the view mounted inside an inert hidden panel to preserve them on close/reopen. They are held only in memory: a reload or session remount clears them. No private draft is stored in localStorage.

Help search requires all query terms and ranks title matches above category and body matches. Results show highlighted excerpts. The message composer suggests up to three related articles from meaningful words in the draft; visitors can read one and go Back without losing their writing. Optional `HelpArticle.blocks` supports headings, paragraphs, lists, and code as escaped text; a nonempty block array replaces `body` for rendering and search. An empty block array falls back to `body`. Same-category articles appear below an article. Raw HTML is never interpreted. Search has a clear button that keeps keyboard focus in the field. Long preview titles are shortened visually; opening an item shows its full text. The UI adapts to touch input, short viewports, device safe areas, and reduced motion.

Data and asynchronous actions belong to the embedding application. Resolve a callback only after a successful save, and update the supplied data to show the result. Callback return values are ignored, so an action can return its saved record. A rejected callback preserves the draft and offers retry. Without a callback, its action is disabled. Existing one-argument send/feedback callback implementations still work; they now receive a second `SubmissionOptions` argument. The UI always supplies it.

| Contract | Behavior |
| --- | --- |
| `onSendMessage(body, { idempotencyKey })`, `onSubmitFeedback(body, { idempotencyKey })`, `onReplyMessage(conversationId, body, { idempotencyKey })` | Trimmed body; one pending submission per draft. A retry of unchanged content reuses its key, including after a lost response. Editing the content creates a new key. The server must persist idempotency receipts; the UI alone cannot guarantee exactly-once writes. |
| `loadState`, `connection`, `onRetryLoad()` | Loading/error placeholders avoid false empty states. Cached content remains readable. Offline/reconnecting disables mutations but keeps drafts editable. Reconnection never automatically submits a draft. The host owns connectivity and recovery. |
| `onVoteFeedback(postId, voted)`, `onFollowFeedback(postId, following)` | Desired booleans, including reversal. The host returns updated `votes`, `voted`, and `following` through props. Status filters accept `open`, `planned`, `in_progress`, and `shipped`; omitted status means open. |
| `onReadConversation(conversationId, throughMessageId)`, `onReadUpdate(entryId)` | Opening an unread item requests acknowledgment; failed acknowledgments retain the unread state and can be retried. The host must return authoritative unread counts and advance conversation watermarks monotonically. New messages arriving while a thread is open remain unread until acknowledged. |
| `Conversation.messages` | Optional `sentAt` ISO timestamps and `fromVisitor` enable date grouping and visitor bubbles. Sent labels describe persisted visitor messages, not delivery or read receipts. Invalid timestamps are omitted. |
| `teamAvailability` | Optional host-verified text. Omit it when unknown; the view does not invent live presence or a response-time promise. |

Home resumes an unread or recent conversation and highlights a supplied unread update. Navigation and the Storybook launcher show unread indicators. Feedback can be sorted by supplied order, votes, or title, or viewed as a grouped Roadmap. Optional update reactions use `UpdateEntry.reactions` and `onReactToUpdate(entryId, emoji)`; `onShareUpdate(entry)` owns sharing. Those controls disable while pending/offline and show errors on rejection. Update the supplied counts after success. This view does not authenticate visitors, upload to a server, or fetch content. Presentation copy and suggestion stop words are currently English; the SDK's existing locale forwarding is unchanged.

Full help and update readers call `onExpandedChange(true)`; Back and unmount request `false`. The host must apply the size or forward the existing `quackback:expand` protocol. The SDK desktop expansion is 480 × 860 px, viewport constrained. Readers and requests hide bottom navigation; new conversations retain the Quills footer. An article's optional HTTP(S) `url` opens with `noopener noreferrer`.

`FeedbackPost.comments` supplies the discussion. `onCommentFeedback(postId, body, {idempotencyKey, parentId?})` posts a root comment or reply; `onVoteComment(postId, commentId, voted)` sets the desired vote state. Failed comment/reply drafts survive navigation; the adapter must update comments and counts through props. `voters`, author metadata, and verified flags are optional authorized server data. `UpdateEntry.blocks`, `authorRole`, `relatedPostIds`, and `requesterCount` support the full update reader.

Set `attachmentsEnabled` only when send/feedback/reply callbacks process `SubmissionOptions.attachments: readonly File[]`. The picker accepts up to four PNG/JPEG/WebP images, each at most 5 MiB, with MIME/signature checks. Attachment-only submissions have an empty body. Files remain in memory through navigation/failure and clear after success or session remount; editing/removing a file rotates the idempotency key. Preview object URLs are revoked when their view unmounts. Published `Attachment` records use `{id, name, url}`; host-supplied URLs must be authorized for the current visitor. Client checks do not replace server image validation.

Feedback's camera uses user-invoked `getDisplayMedia`, without audio; streams stop after capture, cancellation, or failure. The browser's chooser and secure context/Permissions Policy requirements still apply. Unsupported browsers retain image selection. `onCaptureScreenshot(signal)` can supply an approved host capture implementation. The review dialog can highlight or redact rectangles, supports keyboard position controls and Undo, and exports a flattened PNG (up to 2048 px on its longest side). Cancel preserves the original. No screenshot is silently captured or sent. Real uploads, authorization, image sanitization, and retention are specified in [RFC 0004](rfcs/0004-images-and-capture.md).

This checkout has no application serving the widget iframe. The new UI is an optional presentation entry, not an automatic replacement for a deployed instance's `/widget` page. That page must mount the view and connect its data, actions, and existing iframe protocol. The SDK's commands, events, deep links, and protocol remain unchanged. React stays optional for the root, version, and browser entries; the UI and its locally served Inter font are excluded from the browser SDK bundle. Inter's [SIL Open Font License](src/ui/fonts/OFL.txt) is included with the font. The selected official SVG paths from `@phosphor-icons/core` 2.1.1 are vendored with the [Phosphor MIT license](src/icons/LICENSE), shared by the React UI and vanilla launcher. No icon runtime dependency is required.

### Activity, media, and contextual help

The optional `/ui` entry now supports image paste and drag/drop within enabled composers, using the same four-image / 5 MiB PNG/JPEG/WebP validation and retry payload as the picker. Text paste remains native. Attachments open inside an accessible image viewer with previous/next, zoom, Escape, and focus return. No document-wide clipboard/drop listeners or runtime dependencies were added.

Conversations keep an opening unread divider, start at the first unread team message (otherwise the bottom), and follow arrivals only within 80 px of the bottom. Jump to latest resumes following. Enter adds a newline; Command/Control+Enter sends outside IME composition. Opening a thread retains the existing acknowledgment callback through the newest displayed message; the divider does not imply a new server read receipt.

Supply `activities: RequestActivity[]` and `onReadActivity(id)` to enable a private activity feed from the header. Items are newest first and open their `postId`; Mark as read is explicit. `HelpArticle.helpful` and `onArticleFeedback(articleId, boolean)` enable Yes/No feedback. These callbacks resolve only after authoritative props update; rejection leaves state unchanged with a retryable error.

Still need help opens an article-specific conversation draft and passes optional `SubmissionOptions.articleId` to `onSendMessage`. Ordinary message drafts stay separate. The host adapter must verify and persist that context; existing callbacks remain source-compatible but must adopt this option to retain article context on the server. Key the view by visitor as before.

Storybook's Activity, Article Feedback, Conversation Reading, and Image Viewer stories exercise these additions. Follow a request before using Simulate request progress/reply; switch Demo visitor to check isolation. Everything stays in memory. [RFC 0005](rfcs/0005-activity-and-article-feedback.md) specifies the real activity/helpfulness/context backend; RFCs 0002 and 0004 cover conversation and media requirements. No real API, inbox delivery, durable upload, or notification service is implemented here.

## Development checks

### Storybook

From the repository root:

```sh
pnpm --dir packages/widget storybook
```

Open http://localhost:6006. **Widget / Design** previews all five screens, dark mode,
mobile, empty data, long content, no search results, and successful/failed/pending submissions. **Expanded Update**, **Expanded Help**, **Request Discussion**, **Roadmap**, **New Conversation**, and **Feedback Composer** cover the supplied detail references. **Connected**, **Conversation**, **Draft Continuity**, **Feedback Actions**, **Loading**, **Load Failure**, and **Offline** exercise the new flows. The pending story intentionally keeps its callback unresolved so the sending state can be inspected. The local mock in `stories/mock-backend.ts` simulates latency, visitor isolation, persisted-in-memory idempotency receipts, unread watermarks, and mutation failures. The preview controls can switch visitors, disconnect/reconnect, inject a team reply, fail before saving, or save then lose the response. Retrying that last case demonstrates deduplication. Nothing is sent to a server; all mock data resets on story remount.

Navigation, search, composers, close, and reopen work without a backend. **Widget / Launcher** exposes placement, colors, label,
greeting, unread count, and open state through Controls. **Widget / SDK** runs the
actual React hooks and singleton with a local iframe fixture. It includes left
placement, no launcher, delayed initialization, disabled initialization, and mobile
stories. The playground supports anonymous/Ada/Grace identity changes, opening a
demo article, and iframe-driven close, expansion, and unread updates.

The SDK story's iframe is a protocol fixture, separate from the visual Design stories. Analytics is off,
all demo identities use `example.com`, and no running backend is needed. Each story
cleans up its launcher or SDK on unmount. Changing SDK Controls remounts the
playground; the identity radio buttons exercise live identity changes.

```sh
pnpm --dir packages/widget storybook:build
```

This writes `packages/widget/storybook-static/`, which is ignored by Git and
excluded from the published package. Serve that folder with a static server that
supports directory index files. The Storybook development configuration supplies
the equivalent `/fixtures/widget` redirect. The default launcher, SDK, and submission stories
include interaction assertions visible in Storybook's Interactions panel.

Storybook and its React/Vite framework are development dependencies. The package
typecheck includes Storybook configuration and stories. Storybook and demo data
are excluded from the published package and production builds.

The [backend RFC index](rfcs/README.md) specifies the remaining iframe application, authenticated API, durable writes, realtime delivery, and content integrations. These are proposed work, not implemented server endpoints.

### Package checks

From the repository root:

```sh
pnpm --dir packages/widget test
pnpm --dir packages/widget typecheck
pnpm --dir packages/widget build
pnpm exec vp check packages/widget
```

Tests use the repository's Vite+ runner. The package tests include a fresh build and isolated ESM/CommonJS import, declaration-consumer, and browser-IIFE probes. DOM tests disable remote iframe loading; cross-origin browser checks require a real browser and a cooperating iframe server.

## Docs

Full documentation: https://quackback.io/docs/widget

## License

[MIT](LICENSE). This package and the `sdk.js` script built from it are MIT, so you can ship them in closed-source apps.
