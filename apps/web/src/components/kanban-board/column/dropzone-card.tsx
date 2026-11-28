import { motion } from "motion/react";
import { memo, type Ref } from "react";
import type Task from "@/types/task";
import TaskCard from "../task-card";

const CARD_ENTER = { type: "spring", duration: 0.3, bounce: 0 } as const;
const CARD_EXIT = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const;

type DropzoneCardProps = {
  task: Task;
  isActive: boolean;
  animateEntry: boolean;
  reduceMotion: boolean;
  disableDragDrop: boolean;
  isFinalColumn?: boolean;
  ref?: Ref<HTMLDivElement>;
};

function DropzoneCard({
  task,
  isActive,
  animateEntry,
  reduceMotion,
  disableDragDrop,
  isFinalColumn,
  ref,
}: DropzoneCardProps) {
  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: "scale(0.98)" };
  const shown = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, transform: "scale(1)" };

  return (
    <motion.div
      ref={ref}
      initial={!animateEntry || isActive ? false : hidden}
      animate={shown}
      exit={isActive ? undefined : { ...hidden, transition: CARD_EXIT }}
      transition={CARD_ENTER}
    >
      <TaskCard
        task={task}
        disableDragDrop={disableDragDrop}
        isFinalColumn={isFinalColumn}
      />
    </motion.div>
  );
}

export default memo(DropzoneCard);
