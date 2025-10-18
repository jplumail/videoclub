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
  /**
   * Optional href to use instead of the computed one
   * (e.g., on person page, link movie card directly to the video page).
   */
  hrefOverride?: string;
  /** Optional text displayed inside the small link badge. */
  badgeText?: string;
  /** Optional handler triggered when clicking the media element. */
  onMediaClick?: () => void;
  /** Optional explicit href used to wrap the media element in a Link. */
  mediaHref?: string;
  /** Accessible label announced when activating the media element. */
  mediaAriaLabel?: string;
  /** Whether to display the small badge when the media is wrapped in a Link. */
  showMediaBadge?: boolean;
}

export function Card({
  item,
  media,
  children,
  hasDetails = true,
  hrefOverride,
  badgeText,
  onMediaClick,
  mediaHref,
  mediaAriaLabel,
  showMediaBadge = true,
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

  const effectiveHref = hrefOverride || href;
  const wrapMediaWithLink = (!hasDetails && Boolean(hrefOverride)) || Boolean(mediaHref);
  const wrapMediaWithButton = Boolean(onMediaClick);
  const computedBadgeText =
    badgeText || (hrefOverride?.startsWith("/video/") ? "Voir l’extrait" : "Ouvrir");
  const defaultMediaAriaLabel = title
    ? `Aller au premier extrait : ${title}`
    : "Aller au premier extrait";
  const effectiveMediaAriaLabel = mediaAriaLabel || defaultMediaAriaLabel;

  const mediaContent = wrapMediaWithLink ? (
    // Wrap the media in a Link either when the overlay is disabled with an
    // explicit hrefOverride, or when a dedicated mediaHref is provided (e.g. best media pages).
    <Link
      href={mediaHref || effectiveHref}
      aria-label={effectiveMediaAriaLabel}
      className={styles.mediaLink}
    >
      {showMediaBadge && (
        <span className={styles.playBadge} aria-hidden="true">
          {/* simple play icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
          {computedBadgeText}
        </span>
      )}
      {media}
    </Link>
  ) : wrapMediaWithButton ? (
    <button
      type="button"
      className={styles.mediaButton}
      onClick={onMediaClick}
      aria-label={effectiveMediaAriaLabel}
    >
      {media}
    </button>
  ) : (
    media
  );

  return (
    <div
      className={`${styles.container} ${isActive ? styles.active : ""} ${
        wrapMediaWithLink || wrapMediaWithButton ? styles.clickable : ""
      }`}
    >
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
      {mediaContent}
      {hasDetails && (
        <div className={styles.children}>
          <div className={styles.detailsContent}>{children}</div>
          <p className={styles.movieDetails}>
            <Link href={effectiveHref} className={styles.details}>
              <span className={styles.title}>{title}</span>
            </Link>
            {year && <span> - {year}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
