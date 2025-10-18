import Link from "next/link";
import type { ReactNode } from "react";
import { MediaIdData } from "@/lib/backend/types";
import { MovieCard } from "@/components/MovieCard";
import { PersonCard } from "@/components/PersonCard";
import Gallery from "@/components/Gallery";
import { getTitle, slugify } from "@/lib/utils";
import { ConfigurationManager } from "@/lib/data/tmdb";
import personnaliteStyles from "@/components/styles/Personnalites.module.css";
import styles from "./movieDetails.module.css";
import { MovieInfoPanel } from "./MovieInfoPanel";

export async function MovieDetails({
  movie,
  kind,
}: {
  movie: MediaIdData;
  kind: "film" | "serie";
}) {
  const release = movie.release_year ? new Date(movie.release_year) : null;
  const tmdbDetails = await ConfigurationManager.getMediaDetailsById(
    kind === "film" ? "movie" : "tv",
    movie.id,
  );
  const directorName =
    tmdbDetails && tmdbDetails.directors.length > 0
      ? tmdbDetails.directors.join(", ")
      : "Aucune information disponible.";
  const infoItems: { label: string; value: ReactNode }[] = [
    { label: "Réalisateur", value: directorName },
  ];

  if (tmdbDetails?.genres.length) {
    infoItems.push({ label: "Genres", value: tmdbDetails.genres.join(", ") });
  }

  if (tmdbDetails?.runtimeMinutes && tmdbDetails.runtimeMinutes > 0) {
    infoItems.push({
      label: "Durée",
      value: `${tmdbDetails.runtimeMinutes} min`,
    });
  } else if (
    tmdbDetails?.episodeRuntimeMinutes &&
    tmdbDetails.episodeRuntimeMinutes > 0
  ) {
    infoItems.push({
      label: "Durée d’un épisode",
      value: `${tmdbDetails.episodeRuntimeMinutes} min`,
    });
  }

  if (tmdbDetails && tmdbDetails.voteAverage !== null) {
    const note = tmdbDetails.voteAverage.toFixed(1);
    const voteDetails =
      tmdbDetails.voteCount !== null
        ? ` (${tmdbDetails.voteCount} vote${tmdbDetails.voteCount && tmdbDetails.voteCount > 1 ? "s" : ""})`
        : "";
    infoItems.push({ label: "Note TMDB", value: `${note} / 10${voteDetails}` });
  }

  if (tmdbDetails?.originCountries.length) {
    infoItems.push({
      label: "Pays d’origine",
      value: tmdbDetails.originCountries.join(", "),
    });
  }

  if (tmdbDetails?.originalTitle) {
    const normalizedDisplayedTitle = (movie.title ?? "").trim().toLowerCase();
    const normalizedOriginalTitle = tmdbDetails.originalTitle
      .trim()
      .toLowerCase();
    if (
      normalizedOriginalTitle &&
      normalizedOriginalTitle !== normalizedDisplayedTitle
    ) {
      infoItems.push({
        label: "Titre original",
        value: tmdbDetails.originalTitle,
      });
    }
  }

  if (tmdbDetails?.tmdbUrl) {
    infoItems.push({
      label: "TMDB",
      value: (
        <a
          className={styles.tmdbLink}
          href={tmdbDetails.tmdbUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {tmdbDetails.tmdbUrl}
        </a>
      ),
    });
  }

  if (tmdbDetails?.homepage) {
    infoItems.push({
      label: "Site officiel",
      value: (
        <a
          className={styles.homepageLink}
          href={tmdbDetails.homepage}
          target="_blank"
          rel="noopener noreferrer"
        >
          {tmdbDetails.homepage}
        </a>
      ),
    });
  }

  const synopsis = tmdbDetails?.overview;
  const toggleId = `movie-info-${kind}-${movie.id ?? "unknown"}`;
  const citedCount = movie.citations.length;
  const citedLabel = citedCount > 1 ? "personnes" : "personne";

  return (
    <>
      <h1 className={styles.movieTitle}>
        {movie.title}
        {release && <span> ({release.getFullYear().toString()})</span>}
      </h1>
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.posterWrapper}>
            <MovieCard
              media={{
                id: movie.id,
                type: kind === "film" ? "movie" : "tv",
                title: movie.title,
                original_title: movie.original_title ?? movie.title ?? null,
                release_year: movie.release_year,
              }}
              hasDetails={false}
            />
          </div>

          <MovieInfoPanel
            infoItems={infoItems}
            tagline={tmdbDetails?.tagline}
            synopsis={synopsis}
            toggleId={toggleId}
          />
        </div>
      </section>

      <section className={styles.citedSection}>
        <h2 className={styles.citedHeading}>
          Cité par{" "}
          <span className={styles.citedCount}>
            {citedCount} {citedLabel}
          </span>
        </h2>
        <Gallery>
          {movie.citations.map((c, index) => {
            const first = c.videoIds[0];
            const href = first
              ? `/video/${first}#${slugify(
                  getTitle({
                    id: movie.id,
                    type: kind === "film" ? "movie" : "tv",
                    title: movie.title,
                    original_title: movie.original_title ?? movie.title ?? null,
                    release_year: movie.release_year,
                  }) || "",
                )}`
              : "#";
            return (
              <li key={index}>
                <PersonCard
                  person={c.personnalite}
                  hasDetails={false}
                  hrefOverride={href}
                  badgeText="Voir l’extrait"
                />
                <p className={personnaliteStyles.container}>
                  <Link
                    className={styles.personLink}
                    href={`/personne/${c.personnalite.person_id}`}
                  >
                    {c.personnalite.name}
                  </Link>
                </p>
              </li>
            );
          })}
        </Gallery>
      </section>
    </>
  );
}
