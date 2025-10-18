import { MediaIdData } from "@/lib/backend/types";
import { MovieCard } from "@/components/MovieCard";
import { PersonCard } from "@/components/PersonCard";
import Gallery from "@/components/Gallery";
import { getTitle, slugify } from "@/lib/utils";
import { ConfigurationManager } from "@/lib/data/tmdb";

export async function MovieDetails({
  movie,
  kind,
}: {
  movie: MediaIdData;
  kind: "film" | "serie";
}) {
  const release = movie.release_year ? new Date(movie.release_year) : null;
  const directionDetails = await ConfigurationManager.getDirectionDetailsById(
    kind === "film" ? "movie" : "tv",
    movie.id,
  );
  const directorName =
    directionDetails && directionDetails.directors.length > 0
      ? directionDetails.directors.join(", ")
      : "Aucune information disponible.";
  return (
    <>
      <h1>
        {movie.title}
        {release && <span> ({release.getFullYear().toString()})</span>}
      </h1>
      <section>
        <div>
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <MovieCard media={{ id: movie.id, type: kind === "film" ? "movie" : "tv", title: movie.title, release_year: movie.release_year }} hasDetails={false} />
            </div>
          </div>

          <div>
            <section>
              <h2>Réalisation</h2>
              <p>{directorName}</p>
              {directionDetails?.tmdbUrl && (
                <p>
                  <a
                    href={directionDetails.tmdbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir la fiche sur TMDB
                  </a>
                </p>
              )}
            </section>
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
