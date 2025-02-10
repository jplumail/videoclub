"use client";

import Link from "next/link";
import styles from "./styles/Card.module.css";
import { useState } from "react";
import { PartialMedia, Person } from "@/lib/backend/types";

export interface CardBaseProps {
  item: Person | PartialMedia;
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
  const id = item.id || 0;
  let href = "";
  let title = "";
  let year: number | null = null;
  if (item.media_type == "movie" || item.media_type == "tv") {
    href = item.media_type === "movie" ? `/film/${id}` : `/serie/${id}`;
    title = (item.title as string) || (item.name as string) || "";
    const commonDate =
      (item.release_date as string) || (item.first_air_date as string);
    const date = commonDate ? new Date(commonDate) : null;
    year = date ? date.getFullYear() : null;
  } else {
    href = `/personne/${id}`;
    title = item.name || "";
  }

  return (
    <div className={`${styles.container} ${isActive ? styles.active : ""}`}>
      {hasDetails && (
        <button
          title="Afficher/masquer les détails"
          className={styles.toggleButton}
          onClick={() => setIsActive(!isActive)}
          aria-label="Afficher les détails"
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
