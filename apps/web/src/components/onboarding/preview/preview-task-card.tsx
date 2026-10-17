import { motion, useReducedMotion } from "framer-motion";
import { Minus } from "lucide-react";
import { useTranslation } from "react-i18next";

type PreviewTaskCardProps = {
  ticket: string;
  title: string;
  order: number;
};

export function PreviewTaskCard({
  ticket,
  title,
  order,
}: PreviewTaskCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -14, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{
        delay: reduceMotion ? 0 : 0.15 + order * 0.12,
        duration: 0.35,
        ease: [0.23, 1, 0.32, 1],
      }}
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3 shadow-xs/5"
    >
      <span className="font-mono text-[11px] text-muted-foreground">
        {ticket}
      </span>
      <span className="font-medium text-[13px] text-foreground leading-[18px]">
        {title}
      </span>
      <span className="flex h-5 w-fit items-center gap-1 rounded-md border border-border px-1.5 text-[11px] text-muted-foreground">
        <Minus className="size-3" />
        {t("tasks:priority.no-priority")}
      </span>
    </motion.div>
  );
}
