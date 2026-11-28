import { motion, useReducedMotion } from "motion/react";

type PreviewTaskCardProps = {
  ticket: string;
  title: string;
};

export function PreviewTaskCard({ ticket, title }: PreviewTaskCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3 shadow-xs/5"
    >
      <span className="font-mono text-[11px] text-muted-foreground">
        {ticket}
      </span>
      <span className="font-medium text-[13px] text-foreground leading-[18px]">
        {title}
      </span>
    </motion.div>
  );
}
