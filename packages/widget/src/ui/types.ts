export type WidgetTab = "home" | "messages" | "help" | "feedback" | "updates";
export type FeedbackStatus = "open" | "planned" | "in_progress" | "shipped";
export interface SubmissionOptions {
  idempotencyKey: string;
  attachments?: readonly File[];
  /** Article that prompted a new conversation; the server must verify access. */
  articleId?: string;
}
export interface WidgetPerson {
  name: string;
  avatarUrl?: string;
  verified?: boolean;
}
export interface Attachment {
  id: string;
  name: string;
  url: string;
}
export interface FeedbackComment {
  id: string;
  body: string;
  author: string;
  avatarUrl?: string;
  verified?: boolean;
  createdAt?: string;
  parentId?: string;
  votes: number;
  voted?: boolean;
}
export interface HelpFilters {
  query: string;
  category: string | null;
}
export interface FeedbackFilters {
  query: string;
  sort: string;
  status: FeedbackStatus | "all";
  roadmapExpanded?: readonly FeedbackStatus[];
}
export type ArticleBlock =
  | { type: "paragraph" | "heading" | "code"; text: string }
  | { type: "list"; items: readonly string[]; ordered?: boolean };

export interface FeedbackPost {
  id: string;
  title: string;
  body: string;
  author: string;
  votes: number;
  voted?: boolean;
  following?: boolean;
  status?: FeedbackStatus;
  createdAt?: string;
  avatarUrl?: string;
  verified?: boolean;
  voters?: readonly WidgetPerson[];
  comments?: readonly FeedbackComment[];
  attachments?: readonly Attachment[];
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  body: string;
  blocks?: readonly ArticleBlock[];
  author?: WidgetPerson;
  updatedAt?: string;
  url?: string;
  helpful?: boolean;
}

export interface RequestActivity {
  id: string;
  postId: string;
  title: string;
  kind: "reply" | "status" | "shipped";
  summary: string;
  createdAt: string;
  unread: boolean;
}

export interface UpdateEntry {
  id: string;
  title: string;
  body: string;
  date: string;
  author: string;
  authorRole?: string;
  avatarUrl?: string;
  blocks?: readonly ArticleBlock[];
  relatedPostIds?: readonly string[];
  requesterCount?: number;
  unread?: boolean;
  reactions?: ReadonlyArray<{
    emoji: string;
    count: number;
    reacted?: boolean;
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  unreadCount?: number;
  articleId?: string;
  messages: ReadonlyArray<{
    id: string;
    body: string;
    author: string;
    sentAt?: string;
    fromVisitor?: boolean;
    attachments?: readonly Attachment[];
  }>;
}

/** Data is supplied by the embedding application; this view performs no network requests. */
export interface WidgetViewProps {
  brandName?: string;
  theme?: "light" | "dark" | "auto";
  initialTab?: WidgetTab;
  feedback?: readonly FeedbackPost[];
  articles?: readonly HelpArticle[];
  updates?: readonly UpdateEntry[];
  conversations?: readonly Conversation[];
  activities?: readonly RequestActivity[];
  onReadActivity?: (id: string) => Promise<unknown>;
  onArticleFeedback?: (articleId: string, helpful: boolean) => Promise<unknown>;
  /** The host owns loading and connectivity; offline disables mutations, not reading. */
  loadState?: "ready" | "loading" | "error";
  connection?: "online" | "offline" | "reconnecting";
  onRetryLoad?: () => Promise<unknown>;
  /** Display only availability verified by the host; omit when unknown. */
  teamAvailability?: string;
  teamMember?: WidgetPerson;
  /** The host resizes its container or sends the existing quackback:expand message. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Opt in only when submission callbacks process SubmissionOptions.attachments. */
  attachmentsEnabled?: boolean;
  onCaptureScreenshot?: (signal: AbortSignal) => Promise<File | null>;
  onCommentFeedback?: (
    postId: string,
    body: string,
    options: SubmissionOptions & { parentId?: string },
  ) => Promise<unknown>;
  onVoteComment?: (
    postId: string,
    commentId: string,
    voted: boolean,
  ) => Promise<unknown>;
  onReplyMessage?: (
    conversationId: string,
    body: string,
    options: SubmissionOptions,
  ) => Promise<unknown>;
  onReadConversation?: (
    conversationId: string,
    throughMessageId: string,
  ) => Promise<unknown>;
  onReadUpdate?: (entryId: string) => Promise<unknown>;
  onVoteFeedback?: (postId: string, voted: boolean) => Promise<unknown>;
  onFollowFeedback?: (postId: string, following: boolean) => Promise<unknown>;
  onClose: () => void;
  /** Resolve only after the action succeeds. Rejections keep the draft and show an error. */
  onSendMessage?: (
    body: string,
    options: SubmissionOptions,
  ) => Promise<unknown>;
  onSubmitFeedback?: (
    body: string,
    options: SubmissionOptions,
  ) => Promise<unknown>;
  onReactToUpdate?: (entryId: string, emoji: string) => Promise<unknown>;
  onShareUpdate?: (entry: UpdateEntry) => Promise<unknown>;
}
