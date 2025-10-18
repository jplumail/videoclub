import type { ReactNode } from "react";
import styles from "./movieDetails.module.css";

interface InfoItem {
  label: string;
  value: ReactNode;
}

interface MovieInfoPanelProps {
  infoItems: InfoItem[];
  tagline?: string | null;
  synopsis?: string | null;
  toggleId: string;
}

export function MovieInfoPanel({ infoItems, tagline, synopsis, toggleId }: MovieInfoPanelProps) {
  return (
    <div className={styles.infoColumn}>
      <input
        type="checkbox"
        id={toggleId}
        className={styles.mobileToggleInput}
        aria-controls={`${toggleId}-content`}
      />
      <label className={styles.mobileToggle} htmlFor={toggleId}>
        <span className={styles.mobileToggleIcon} aria-hidden="true">
          ▸
        </span>
        <span className={styles.mobileToggleTextClosed}>Afficher les détails</span>
        <span className={styles.mobileToggleTextOpen}>Masquer les détails</span>
      </label>

      <div id={`${toggleId}-content`} className={styles.infoContent}>
        <dl className={styles.infoList}>
          {infoItems.map(({ label, value }) => (
            <div className={styles.infoRow} key={label}>
              <dt className={styles.infoLabel}>{label}</dt>
              <dd className={styles.infoValue}>{value}</dd>
            </div>
          ))}
        </dl>
        {tagline && <p className={styles.tagline}>&ldquo;{tagline}&rdquo;</p>}
        {synopsis && <p className={styles.synopsis}>{synopsis}</p>}
      </div>
    </div>
  );
}
