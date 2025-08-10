"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

export default function DemoSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={
            isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }
          }
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative"
        >
          {/* Video container with clean borders */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-2xl border border-zinc-200 dark:border-zinc-700">
            {/* biome-ignore lint/a11y/useMediaCaption: we don't need a caption */}
            <video
              src="https://assets.kaneo.app/demo.mp4"
              controls
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
