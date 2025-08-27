"use client";

import Link from "next/link";
import styles from "./styles/Card.module.css";
import { useState } from "react";
import { MediaItem, Personnalite } from "@/lib/backend/types";

export interface CardBaseProps {
  item: Personnalite | MediaItem;
  media?: React.ReactElement;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

export function Card({
  item,
  media,
  children,
  hasDetails = true,
}: CardBaseProps) {
  const [isActive, setIsActive] = useState(false);
  let href = "";
  let title = "";
  let year: number | null = null;
  if ((item as MediaItem).type === "movie" || (item as MediaItem).type === "tv") {
    const media = item as MediaItem;
    const id = media.id ?? 0;
    href = media.type === "movie" ? `/film/${id}` : `/serie/${id}`;
    title = media.title || "";
    const date = media.release_year ? new Date(media.release_year) : null;
    year = date ? date.getFullYear() : null;
  } else {
    const person = item as Personnalite;
    const id = person.person_id ?? 0;
    href = `/personne/${id}`;
    title = person.name || "";
  }

  return (
    <div className={`${styles.container} ${isActive ? styles.active : ""}`}>
      {hasDetails && (
        <button
          title="Afficher/masquer les détails"
          className={styles.toggleButton}
          onClick={() => setIsActive(!isActive)}
          aria-label="Afficher les détails"
          aria-expanded={isActive}
        >
          <svg
            width="16"
            height="12"
            viewBox="0 0 12 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${styles.triangle} ${isActive ? styles.rotated : ""}`}
          >
            <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" />
          </svg>
        </button>
      )}
      {media}
      {hasDetails && (
        <div className={styles.children}>
          {children}
          <p className={styles.movieDetails}>
            <Link href={href} className={styles.details}>
              <span className={styles.title}>{title}</span>
            </Link>
            {year && <span> - {year}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
