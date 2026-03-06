"use client";

import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/cn";

// Types
type TimelineContextValue = {
  activeStep: number;
  setActiveStep: (step: number) => void;
};

// Context
const TimelineContext = React.createContext<TimelineContextValue | undefined>(
  undefined,
);

const useTimeline = () => {
  const context = React.useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a Timeline");
  }
  return context;
};

// Components
interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
}

function Timeline({
  defaultValue = 1,
  value,
  onValueChange,
  orientation = "vertical",
  className,
  ...props
}: TimelineProps) {
  const [activeStep, setInternalStep] = React.useState(defaultValue);

  const setActiveStep = React.useCallback(
    (step: number) => {
      if (value === undefined) {
        setInternalStep(step);
      }
      onValueChange?.(step);
    },
    [value, onValueChange],
  );

  const currentStep = value ?? activeStep;

  return (
    <TimelineContext.Provider
      value={{ activeStep: currentStep, setActiveStep }}
    >
      <div
        className={cn(
          "group/timeline flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
          className,
        )}
        data-orientation={orientation}
        data-slot="timeline"
        {...props}
      />
    </TimelineContext.Provider>
  );
}

// TimelineContent
function TimelineContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="timeline-content"
      {...props}
    />
  );
}

// TimelineDate
interface TimelineDateProps extends React.HTMLAttributes<HTMLTimeElement> {
  asChild?: boolean;
}

function TimelineDate({
  asChild = false,
  className,
  ...props
}: TimelineDateProps) {
  const Comp = asChild ? Slot.Root : "time";

  return (
    <Comp
      className={cn(
        "mb-1 block font-medium text-muted-foreground text-xs group-data-[orientation=vertical]/timeline:max-sm:h-4",
        className,
      )}
      data-slot="timeline-date"
      {...props}
    />
  );
}

// TimelineHeader
function TimelineHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} data-slot="timeline-header" {...props} />
  );
}

// TimelineIndicator
interface TimelineIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

function TimelineIndicator({
  asChild = false,
  className,
  children,
  ...props
}: TimelineIndicatorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2 absolute size-4 rounded-full border-2 border-primary/20 group-data-[orientation=vertical]/timeline:top-0 group-data-[orientation=horizontal]/timeline:left-0 group-data-completed/timeline-item:border-primary",
        className,
      )}
      data-slot="timeline-indicator"
      {...props}
    >
      {children}
    </div>
  );
}

// TimelineItem
interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
}

function TimelineItem({ step, className, ...props }: TimelineItemProps) {
  const { activeStep } = useTimeline();

  return (
    <div
      className={cn(
        "group/timeline-item relative flex flex-1 flex-col gap-0.5 group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=horizontal]/timeline:mt-8 group-data-[orientation=horizontal]/timeline:not-last:pe-8 group-data-[orientation=vertical]/timeline:not-last:pb-12 has-[+[data-completed]]:[&_[data-slot=timeline-separator]]:bg-primary",
        className,
      )}
      data-completed={step <= activeStep || undefined}
      data-slot="timeline-item"
      {...props}
    />
  );
}

// TimelineSeparator
function TimelineSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2 absolute self-start bg-primary/10 group-last/timeline-item:hidden group-data-[orientation=horizontal]/timeline:h-0.5 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem-0.25rem)] group-data-[orientation=horizontal]/timeline:w-[calc(100%-1rem-0.25rem)] group-data-[orientation=vertical]/timeline:w-0.5 group-data-[orientation=horizontal]/timeline:translate-x-4.5 group-data-[orientation=vertical]/timeline:translate-y-4.5",
        className,
      )}
      data-slot="timeline-separator"
      {...props}
    />
  );
}

// TimelineTitle
function TimelineTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-medium text-sm", className)}
      data-slot="timeline-title"
      {...props}
    />
  );
}

export {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
};
