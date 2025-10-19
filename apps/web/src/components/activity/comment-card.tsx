import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useEffect, useRef } from "react";
import "@blocknote/shadcn/style.css";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useUserPreferencesStore } from "@/store/user-preferences";

interface CommentCardProps {
  content: string;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  createdAt: string;
}

export default function CommentCard({
  content,
  user,
  createdAt,
}: CommentCardProps) {
  const { theme } = useUserPreferencesStore();
  const isInitializedRef = useRef(false);

  const editor = useCreateBlockNote({
    initialContent: [
      {
        type: "paragraph",
        content: "",
      },
    ],
  });

  useEffect(() => {
    if (content?.trim() && !isInitializedRef.current) {
      const loadMarkdown = async () => {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(content || "");
          editor.replaceBlocks(editor.document, blocks);
          setTimeout(() => {
            editor.isEditable = false;
            isInitializedRef.current = true;
          }, 50);
        } catch (error) {
          console.error("Failed to parse markdown:", error);
          const blocks = await editor.tryParseMarkdownToBlocks("");
          editor.replaceBlocks(editor.document, blocks);
          setTimeout(() => {
            editor.isEditable = false;
            isInitializedRef.current = true;
          }, 50);
        }
      };
      loadMarkdown();
    } else if (!content?.trim() && !isInitializedRef.current) {
      editor.isEditable = false;
      isInitializedRef.current = true;
    }
  }, [content, editor]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                <AvatarFallback className="text-xs font-medium bg-muted">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                {user?.name}
              </span>
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-52 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image ?? ""} alt={user?.name || ""} />
                <AvatarFallback className="text-xs font-medium bg-muted">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-none">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {user?.email}
                </p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        <span className="text-xs text-muted-foreground/60">
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </span>
      </div>
      <div className="border border-border rounded-lg bg-card/50 backdrop-blur-sm p-4">
        <div className="blocknote-transparent [&_.bn-editor]:!cursor-default [&_.ProseMirror]:!outline-none [&_.ProseMirror]:!min-h-0">
          <BlockNoteView
            editor={editor}
            className="[&>div:first-of-type]:!pl-0 [&>div:first-of-type]:!bg-transparent [&_.bn-block-content]:!cursor-default [&>div:first-of-type]:!min-h-0"
            formattingToolbar={false}
            linkToolbar={false}
            filePanel={false}
            sideMenu={false}
            tableHandles={false}
            theme={theme as "dark" | "light"}
          />
        </div>
      </div>
    </div>
  );
}
