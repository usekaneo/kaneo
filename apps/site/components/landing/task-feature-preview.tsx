"use client";

import {
  Calendar,
  ChevronDown,
  GitMerge,
  GitPullRequest,
  RotateCcw,
} from "lucide-react";
import { useId, useState } from "react";
import { GithubIcon } from "@/components/icons/github-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getColumnIcon } from "@/lib/column";
import { landing } from "@/lib/landing";
import { getPriorityIcon } from "@/lib/priority";
import messages from "../../../../i18n/en-US.json";
import styles from "./features.module.css";

const copy = landing.features.preview;

// Presentational excerpts of the app task sheet and resources accordion.
// Demo interactions are local; authenticated mutations remain in apps/web.
export function TaskFeaturePreview({ github = false }: { github?: boolean }) {
  const [merged, setMerged] = useState(false);
  return (
    <figure
      className={styles.preview}
      data-preview={github ? "github" : "tasks"}
      aria-label={github ? copy.githubAlt : copy.taskAlt}
    >
      <div className={styles.previewHeader}>
        <span>WEB-24</span>
        {github && (
          <span
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
            aria-live="polite"
          >
            {getColumnIcon(merged ? "done" : "in-review")}
            {merged ? copy.done : copy.inReview}
          </span>
        )}
      </div>
      {!github && (
        <div className="flex flex-row flex-wrap gap-1 items-center p-2 w-full bg-sidebar border-b border-border">
          <span
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "justify-start h-7 px-1.5 gap-1.5 cursor-default",
            })}
          >
            {getColumnIcon("in-progress")}
            <span className="text-xs font-semibold truncate">
              {copy.inProgress}
            </span>
          </span>
          <span
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "justify-start h-7 px-1.5 gap-1.5 cursor-default",
            })}
          >
            {getPriorityIcon("high")}
            <span className="text-xs font-semibold truncate">{copy.high}</span>
          </span>
          <span
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "justify-start h-7 px-1.5 gap-1.5 cursor-default",
            })}
          >
            <Avatar className="h-4 w-4">
              <AvatarFallback className="text-[9px] font-medium border border-border/30">
                PB
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-semibold truncate max-w-[100px]">
              Pam Beesly
            </span>
          </span>
          <span
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "justify-start h-7 px-1.5 gap-1.5 cursor-default",
            })}
          >
            <Calendar className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">{copy.date}</span>
          </span>
        </div>
      )}
      <div className={styles.previewBody}>
        <div className="flex flex-col gap-2.5">
          <h3 className={styles.taskTitle}>{copy.taskTitle}</h3>
          {!github && (
            <div className={styles.taskDescription}>
              <p>{copy.taskDescription}</p>
            </div>
          )}
        </div>
        {github ? <ResourcesPreview merged={merged} /> : <SubtasksPreview />}
      </div>
      {github ? (
        <figcaption className={styles.previewFooter}>
          <span aria-live="polite">
            {merged ? copy.mergedHint : copy.tryGithub}
          </span>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setMerged(!merged)}
            className={styles.demoAction}
          >
            {merged ? (
              <RotateCcw className="size-3.5" />
            ) : (
              <GitMerge className="size-3.5" />
            )}
            {merged ? copy.resetAction : copy.mergeAction}
          </Button>
        </figcaption>
      ) : (
        <figcaption className={styles.previewFooter}>
          {copy.trySubtasks}
        </figcaption>
      )}
    </figure>
  );
}

function SubtasksPreview() {
  const id = useId();
  const [completed, setCompleted] = useState([true, false]);
  const count = completed.filter(Boolean).length;
  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronDown className="size-4" />
          {messages.tasks.subtasks.title}
        </span>
        <span
          className="flex items-center gap-1.5 ml-0.5"
          aria-live="polite"
          aria-atomic="true"
        >
          <svg
            width="16"
            height="16"
            className="shrink-0 -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="8"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-border"
            />
            <circle
              cx="8"
              cy="8"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={14 * Math.PI}
              strokeDashoffset={14 * Math.PI * (1 - count / 2)}
              strokeLinecap="round"
              className={
                count === 2 ? "text-success-foreground" : "text-primary"
              }
            />
          </svg>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            {count}/2
          </span>
          <span className="sr-only">
            {copy.progress
              .replace("{{completed}}", String(count))
              .replace("{{total}}", "2")}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {[copy.checklistDone, copy.checklistOpen].map((title, index) => (
          <label
            htmlFor={`${id}-${index}`}
            key={title}
            className={`${styles.interactiveRow} flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer`}
          >
            <Checkbox
              id={`${id}-${index}`}
              aria-labelledby={`${id}-${index}-title`}
              checked={completed[index]}
              onCheckedChange={(checked) =>
                setCompleted((prev) =>
                  prev.map((value, i) => (i === index ? checked : value)),
                )
              }
            />
            <span
              className="shrink-0 flex items-center justify-center rounded p-0.5"
              aria-hidden="true"
            >
              {getColumnIcon(completed[index] ? "done" : "to-do")}
            </span>
            <span
              id={`${id}-${index}-title`}
              className={`text-sm block flex-1 min-w-0 ${completed[index] ? "line-through text-muted-foreground" : "text-foreground/90"}`}
            >
              {title}
            </span>
            <Avatar className="h-5 w-5" aria-hidden="true">
              <AvatarFallback className="text-[9px] font-medium border border-border/30">
                PB
              </AvatarFallback>
            </Avatar>
          </label>
        ))}
      </div>
    </div>
  );
}

function ResourcesPreview({ merged }: { merged: boolean }) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1 h-8 text-sm text-muted-foreground">
        <ChevronDown className="size-4" />
        {messages.settings.externalLinks.resources}
      </div>
      <div className="flex flex-col gap-2 mt-2">
        {["issue", "pull_request"].map((type) => (
          <div
            key={type}
            className={`flex items-center gap-3 py-3 px-3 rounded-md ${type === "pull_request" ? "bg-accent" : ""}`}
          >
            <GithubIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm min-w-0 flex-1 text-foreground/90">
              {copy.taskTitle}
              <span className="text-muted-foreground ml-2">
                #{type === "issue" ? "24" : "42"}
              </span>
            </span>
            {type === "issue" ? (
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                {messages.settings.externalLinks.issue}
              </span>
            ) : (
              <span
                className={`flex items-center gap-1 font-medium text-xs shrink-0 ${merged ? "text-info-foreground" : "text-success-foreground"}`}
              >
                {merged ? (
                  <GitMerge className="size-3" />
                ) : (
                  <GitPullRequest className="size-3" />
                )}
                {merged
                  ? messages.settings.externalLinks.merged
                  : messages.settings.externalLinks.open}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
