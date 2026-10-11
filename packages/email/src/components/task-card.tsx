import { Column, Text } from "@react-email/components";
import React from "react";
import { Row } from "./row";
import { Section } from "./section";
import { ThemedImg } from "./themed-img";
import { colors, shadow } from "./tokens";

void React;

export type TaskCardLabel = {
  name: string;
  color: string;
};

export type TaskCardPriority = "urgent" | "high" | "medium" | "low";

export type TaskCardDueStatus = "overdue" | "due-soon" | "far-future";

export type TaskCardProps = {
  ticket?: string;
  title: string;
  labels?: TaskCardLabel[];
  priority?: TaskCardPriority;
  priorityLabel?: string;
  dueDate?: string;
  dueStatus?: TaskCardDueStatus;
  assigneeInitials?: string;
};

const dueIcons: Record<TaskCardDueStatus, string> = {
  overdue: "due-overdue",
  "due-soon": "due-soon",
  "far-future": "due-far-future",
};

const dueColors: Record<TaskCardDueStatus, string> = {
  overdue: colors.destructiveForeground,
  "due-soon": colors.warningForeground,
  "far-future": colors.mutedForeground,
};

const dueClasses: Record<TaskCardDueStatus, string> = {
  overdue: "k-destructive",
  "due-soon": "k-warning",
  "far-future": "k-muted",
};

export function TaskCard({
  ticket,
  title,
  labels,
  priority,
  priorityLabel,
  dueDate,
  dueStatus = "far-future",
  assigneeInitials,
}: TaskCardProps) {
  const hasMeta = Boolean(priority || dueDate);

  return (
    <Section className="k-card" style={card}>
      <Row>
        <Column className="k-muted" style={ticketCell}>
          {ticket ?? ""}
        </Column>
        <Column align="right" style={avatarCell}>
          {assigneeInitials ? (
            <div className="k-chip k-text k-divider" style={avatar}>
              {assigneeInitials}
            </div>
          ) : null}
        </Column>
      </Row>
      <Text
        className="k-text-95"
        style={{
          ...titleStyle,
          marginBottom: hasMeta || labels?.length ? "10px" : "0",
        }}
      >
        {title}
      </Text>
      {labels?.length ? (
        <Text style={labelRow}>
          {labels.map((label) => (
            <span key={label.name} className="k-text-85" style={labelStyle}>
              <span
                aria-hidden="true"
                style={{ ...labelDot, color: label.color }}
              >
                ●
              </span>
              {label.name}
            </span>
          ))}
        </Text>
      ) : null}
      {hasMeta ? (
        <Text style={metaRow}>
          {priority ? (
            <span style={metaItem}>
              <ThemedImg
                name={`priority-${priority}`}
                width={12}
                height={12}
                alt={priorityLabel ?? priority}
                style={metaIcon}
              />
            </span>
          ) : null}
          {dueDate ? (
            <span
              className={dueClasses[dueStatus]}
              style={{ ...metaItem, color: dueColors[dueStatus] }}
            >
              <ThemedImg
                name={dueIcons[dueStatus]}
                width={12}
                height={12}
                style={{ ...metaIcon, marginRight: "4px" }}
              />
              {dueDate}
            </span>
          ) : null}
        </Text>
      ) : null}
    </Section>
  );
}

const card = {
  borderRadius: "10px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.border,
  backgroundColor: colors.background,
  boxShadow: shadow,
  padding: "12px",
};

const ticketCell = {
  width: "100%",
  paddingBottom: "4px",
  verticalAlign: "middle" as const,
  color: colors.mutedForeground,
  fontSize: "11px",
  lineHeight: "20px",
  fontWeight: "500",
};

const avatarCell = {
  width: "20px",
  paddingBottom: "4px",
  verticalAlign: "middle" as const,
};

const avatar = {
  width: "18px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: colors.input,
  borderRadius: "50%",
  backgroundColor: colors.muted,
  color: colors.foreground,
  fontSize: "10px",
  lineHeight: "18px",
  fontWeight: "500",
  textAlign: "center" as const,
};

const titleStyle = {
  margin: "0",
  paddingRight: "24px",
  color: colors.foreground95,
  fontSize: "15px",
  lineHeight: "20px",
  fontWeight: "500",
};

const labelRow = {
  margin: "0 0 10px",
  fontSize: "10px",
  lineHeight: "14px",
};

const labelStyle = {
  display: "inline-block",
  marginRight: "10px",
  color: colors.foreground85,
  fontSize: "10px",
  lineHeight: "14px",
  fontWeight: "500",
};

const labelDot = {
  marginRight: "5px",
  fontSize: "8px",
  lineHeight: "14px",
  verticalAlign: "1px",
};

const metaRow = {
  margin: "0",
  fontSize: "10px",
  lineHeight: "22px",
};

const metaItem = {
  display: "inline-block",
  marginRight: "10px",
  fontSize: "10px",
  lineHeight: "22px",
};

const metaIcon = {
  verticalAlign: "-2px",
};
