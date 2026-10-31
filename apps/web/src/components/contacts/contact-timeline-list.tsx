import { useState } from "react";
import { useTranslation } from "react-i18next";
import CommentEditor from "@/components/activity/comment-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ContactTimeline } from "@/fetchers/contact";
import { formatDateTime } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";

const PAGE_SIZE = 20;

type ContactTimelineListProps = {
  entries: ContactTimeline["entries"];
};

// Each editor is a full rich-text view, so reveal the history a page at a time.
export function ContactTimelineList({ entries }: ContactTimelineListProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("workspace:contacts.noInteractions")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="relative space-y-4 border-border border-l ps-5">
        {entries.slice(0, visible).map((entry) => (
          <li key={entry.id} className="relative">
            <span
              aria-hidden="true"
              className="-start-[25px] absolute top-1.5 size-2 rounded-full bg-primary"
            />
            <div className="flex items-center gap-2 text-xs">
              <Avatar className="size-5">
                <AvatarImage src={entry.user.image ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {getInitials(entry.user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{entry.user.name}</span>
              <time
                dateTime={entry.createdAt}
                className="text-muted-foreground"
              >
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <p className="mt-0.5 truncate text-muted-foreground text-xs">
              {entry.taskTitle}
            </p>
            <CommentEditor
              value={entry.content}
              taskId={entry.taskId}
              projectId={entry.projectId}
              uploadSurface="comment"
              readOnly
              className="kaneo-comment-viewer [&_.kaneo-comment-editor-content_.ProseMirror]:px-0 [&_.kaneo-comment-editor-content_.ProseMirror]:py-1"
            />
          </li>
        ))}
      </ol>
      {entries.length > visible ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVisible((current) => current + PAGE_SIZE)}
        >
          {t("workspace:contacts.showMore")}
        </Button>
      ) : null}
    </div>
  );
}
