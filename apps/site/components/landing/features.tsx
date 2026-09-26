import { ArrowUpRight } from "lucide-react";
import { landing } from "@/lib/landing";
import styles from "./features.module.css";
import { RelationsFeaturePreview } from "./relations-feature-preview";
import { TaskFeaturePreview } from "./task-feature-preview";

export function Features() {
  const copy = landing.features;
  return (
    <section id="features" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.featureRow}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{copy.tasks.label}</p>
            <h2>{copy.tasks.title}</h2>
            <p className={styles.description}>{copy.tasks.description}</p>
          </div>
          <TaskFeaturePreview />
        </div>
        <div className={`${styles.featureRow} ${styles.reversed}`}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{copy.github.label}</p>
            <h2>{copy.github.title}</h2>
            <p className={styles.description}>{copy.github.description}</p>
            <a
              href="/docs/core/integrations/github/setup"
              className={styles.link}
            >
              {copy.github.link}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <TaskFeaturePreview github />
        </div>
        <div className={styles.featureRow}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>{copy.relations.label}</p>
            <h2>{copy.relations.title}</h2>
            <p className={styles.description}>{copy.relations.description}</p>
          </div>
          <RelationsFeaturePreview />
        </div>
        <div className={styles.ownership}>
          <div>
            <h3>{copy.hosting.title}</h3>
            <p>{copy.hosting.description}</p>
            <a href="/docs/core" className={styles.link}>
              {copy.hosting.link}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div>
            <h3>{copy.source.title}</h3>
            <p>{copy.source.description}</p>
            <a href="https://github.com/usekaneo/kaneo" className={styles.link}>
              {copy.source.link}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
