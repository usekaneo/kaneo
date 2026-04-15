import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { resolveEmailLocale } from "./resolve-locale";
import { EmailShell, styles } from "./shell";

void React;

export type TaskAssignmentEmailProps = {
  assigneeName: string;
  actorEmail?: string | null;
  actorName?: string | null;
  projectName: string;
  taskIdentifier: string;
  taskTitle: string;
  taskUrl: string;
  locale?: string | null;
};

const messages = {
  en: {
    preview:
      "You were assigned {{taskIdentifier}} in {{projectName}} on Tasks by IPSTUDIO",
    title: "You were assigned {{taskIdentifier}}",
    subtitleWithActor:
      "{{actorName}} ({{actorEmail}}) assigned you a task in {{projectName}}.",
    subtitleWithoutActor: "A task was assigned to you in {{projectName}}.",
    details:
      "Task: {{taskTitle}}. Open it to review the description, due date, and activity.",
    cta: "Open task",
    ignore:
      "If you were not expecting this task, check with your workspace admin or the assigner.",
    footer: "Tasks by IPSTUDIO task assignment",
  },
  de: {
    preview:
      "Dir wurde {{taskIdentifier}} in {{projectName}} auf Tasks by IPSTUDIO zugewiesen",
    title: "{{taskIdentifier}} wurde dir zugewiesen",
    subtitleWithActor:
      "{{actorName}} ({{actorEmail}}) hat dir in {{projectName}} eine Aufgabe zugewiesen.",
    subtitleWithoutActor:
      "Dir wurde in {{projectName}} eine Aufgabe zugewiesen.",
    details:
      "Aufgabe: {{taskTitle}}. Öffne sie, um Beschreibung, Fälligkeitsdatum und Aktivität zu sehen.",
    cta: "Aufgabe öffnen",
    ignore:
      "Falls du diese Aufgabe nicht erwartet hast, frage bei deinem Workspace-Admin oder der zuweisenden Person nach.",
    footer: "Tasks by IPSTUDIO Aufgaben-Zuweisung",
  },
} as const;

function interpolate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return values[key] ?? "";
  });
}

const TaskAssignmentEmail = ({
  assigneeName,
  actorEmail,
  actorName,
  projectName,
  taskIdentifier,
  taskTitle,
  taskUrl,
  locale,
}: TaskAssignmentEmailProps) => {
  const copy = messages[resolveEmailLocale(locale)];
  const values = {
    actorEmail: actorEmail ?? "",
    actorName: actorName ?? "",
    assigneeName,
    projectName,
    taskIdentifier,
    taskTitle,
  };
  const subtitle =
    actorName && actorEmail
      ? interpolate(copy.subtitleWithActor, values)
      : interpolate(copy.subtitleWithoutActor, values);

  return (
    <EmailShell
      preview={interpolate(copy.preview, values)}
      title={interpolate(copy.title, values)}
      subtitle={subtitle}
    >
      <Section>
        <Text style={styles.paragraph}>
          {interpolate(copy.details, values)}
        </Text>
        <Link style={styles.button} href={taskUrl}>
          {copy.cta}
        </Link>
        <Text style={styles.muted}>{copy.ignore}</Text>
        <Section style={styles.divider} />
        <Text style={styles.footer}>{copy.footer}</Text>
      </Section>
    </EmailShell>
  );
};

TaskAssignmentEmail.PreviewProps = {
  assigneeName: "Ash",
  actorEmail: "reid@ipstudio.co",
  actorName: "Reid",
  projectName: "General Tasks",
  taskIdentifier: "IPS-42",
  taskTitle: "Finalize global spec",
  taskUrl:
    "https://tasks.ipstudio.co/dashboard/workspace/workspace123/project/project123/task/task123",
} as TaskAssignmentEmailProps;

export default TaskAssignmentEmail;
