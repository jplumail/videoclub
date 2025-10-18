import type { ReactNode } from "react";
import { MediaIdData } from "@/lib/backend/types";
import { MovieCard } from "@/components/MovieCard";
import { PersonCard } from "@/components/PersonCard";
import Gallery from "@/components/Gallery";
import { getTitle, slugify } from "@/lib/utils";
import { ConfigurationManager } from "@/lib/data/tmdb";
import styles from "./movieDetails.module.css";

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
  const releaseYear = (() => {
    if (release) return release.getFullYear();
    if (tmdbDetails?.releaseYear) return tmdbDetails.releaseYear;
    return null;
  })();
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

  // add TMDB URL and homepage link if available
  if (tmdbDetails?.tmdbUrl) {
    infoItems.push({
      label: "Fiche TMDB",
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
                release_year: movie.release_year,
              }}
              hasDetails={false}
            />
          </div>

          <div className={styles.infoColumn}>
            <dl className={styles.infoList}>
              {infoItems.map(({ label, value }) => (
                <div className={styles.infoRow} key={label}>
                  <dt className={styles.infoLabel}>{label}</dt>
                  <dd className={styles.infoValue}>{value}</dd>
                </div>
              ))}
            </dl>
            {tmdbDetails?.tagline && (
              <p className={styles.tagline}>
                &ldquo;{tmdbDetails.tagline}&rdquo;
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2>Cité par</h2>
        <Gallery>
          {movie.citations.map((c, index) => {
            const first = c.videoIds[0];
            const href = first
              ? `/video/${first}#${slugify(
                  getTitle({
                    id: movie.id,
                    type: kind === "film" ? "movie" : "tv",
                    title: movie.title,
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
                <p style={{ marginTop: ".5rem", fontSize: "1.4rem" }}>
                  {c.personnalite.name}
                </p>
              </li>
            );
          })}
        </Gallery>
      </section>
    </>
  );
}
