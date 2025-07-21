"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef } from "react";

export default function LaptopAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1.05, 1]);
  const y = useTransform(scrollYProgress, [0, 0.5], [50, 0]);

  return (
    <motion.div
      ref={containerRef}
      style={{
        rotateX,
        scale,
        y,
      }}
      className="max-w-5xl mx-auto h-[450px] sm:h-[600px] w-full border-4 border-zinc-700 dark:border-zinc-600 p-2 sm:p-6 bg-zinc-800 dark:bg-zinc-900 rounded-[30px] shadow-2xl"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-white dark:bg-zinc-900">
        <Image
          src="https://assets.kaneo.app/board-light.png"
          alt="Kaneo board interface - Light mode"
          width={1920}
          height={1080}
          className="object-cover h-full w-full object-left-top rounded-lg transition-transform duration-200 hover:scale-[1.02] hidden sm:block dark:hidden"
        />
        <Image
          src="https://assets.kaneo.app/board-dark.png"
          alt="Kaneo board interface - Dark mode"
          width={1920}
          height={1080}
          className="object-cover h-full w-full object-left-top rounded-lg transition-transform duration-200 hover:scale-[1.02] hidden sm:dark:block"
        />

        <div className="relative h-full block sm:hidden">
          <Image
            src="https://assets.kaneo.app/board-light-mobile.png"
            alt="Kaneo board interface mobile - Light mode"
            width={750}
            height={1334}
            className="object-cover h-full w-full object-left-top rounded-lg transition-transform duration-200 hover:scale-[1.02] block dark:hidden"
          />
          <Image
            src="https://assets.kaneo.app/board-dark-mobile.png"
            alt="Kaneo board interface mobile - Dark mode"
            width={750}
            height={1334}
            className="object-cover h-full w-full object-left-top rounded-lg transition-transform duration-200 hover:scale-[1.02] hidden dark:block"
          />
        </div>
      </div>
    </motion.div>
  );
}
