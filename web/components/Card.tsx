"use client";

import Link from "next/link";
import styles from "./Card.module.css";
import { useState } from "react";

export interface CardBaseProps<T> {
  item: T;
  href: string;
  title: string;
  media?: React.ReactElement;
  children?: React.ReactNode;
  hasDetails?: boolean;
  year?: number;
}

export function Card<T>({
  item,
  href,
  title,
  media,
  children,
  hasDetails = true,
  year,
}: CardBaseProps<T>) {
  const [isActive, setIsActive] = useState(false);

  return (
    <div className={`${styles.container} ${isActive ? styles.active : ""}`}>
      {hasDetails && (
        <button
          className={styles.toggleButton}
          onClick={() => setIsActive(!isActive)}
          aria-label="Afficher les détails"
        >
          <svg
            width="12"
            height="8"
            viewBox="0 0 12 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`${styles.triangle} ${isActive ? styles.rotated : ''}`}
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
