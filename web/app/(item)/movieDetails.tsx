import { PartialMedia, Person } from "@/lib/backend/types";
import meilleursStyles from "@/app/(meilleurs)/meilleurs.module.css";
import { MovieCard } from "@/components/MovieCard";
import { PersonCard } from "@/components/PersonCard";
import { BucketManager } from "@/lib/data/bucket";
import MovieCardDetails from "@/components/MovieCardDetails";
import Gallery from "@/components/Gallery";
import { getTitle, slugify } from "@/lib/utils";

export async function MovieDetails({
  movie,
}: {
  movie: {
    movie: PartialMedia;
    personnalites: {
      person: Person;
      videos: Set<string>;
    }[];
  };
}) {
  const movieWithTimestamp = {
    movie: movie.movie,
    personnalites: await Promise.all(
      movie.personnalites.map(async (p) => ({
        person: p.person,
        videos: (
          await Promise.all(
            Array.from(p.videos).map(async (videoId) => {
              const movies = await BucketManager.getMovies(videoId);
              const firstMovieMatch = movies?.filter(
                (m) =>
                  m.media_item.details.media_type == movie.movie.media_type &&
                  m.media_item.details.id == movie.movie.id,
              )[0];
              const video = await BucketManager.getVideos({ videoId });
              if (firstMovieMatch) {
                return {
                  videoId: videoId,
                  timestamp: firstMovieMatch.start_time,
                  title: video.playlist_item.snippet.title,
                };
              }
            }),
          )
        ).filter((v) => v !== undefined),
      })),
    ),
  };
  const date = movie.movie.release_date || movie.movie.first_air_date;
  const release = date ? new Date(date) : null;
  return (
    <>
      <h1>
        {movie.movie.title || movie.movie.name}
        {release && <span> ({release.getFullYear().toString()})</span>}
      </h1>
      <section>
        <div>
          <div>
            <div style={{ marginBottom: "1rem" }}>
              <MovieCard media={movie.movie} hasDetails={false} />
            </div>
          </div>

          <div>
            <section>
              <h2>Résumé</h2>
              <p>{movie.movie.overview}</p>
            </section>
          </div>
        </div>
      </section>

      <section>
        <h2>Cité par</h2>
        <Gallery>
          {movieWithTimestamp.personnalites.map((personnalite, index) => (
            <li key={index}>
              <PersonCard person={personnalite.person}>
                <ul className={meilleursStyles.citeList}>
                  <MovieCardDetails
                    items={Array.from(personnalite.videos).map((video) => ({
                      main: {
                        title: video.title,
                        href: `/video/${video.videoId}#${slugify(getTitle(movie.movie) || "")}`,
                      },
                      youtubeUrls: [
                        {
                          videoId: video.videoId,
                          timestamp: video.timestamp,
                        },
                      ],
                    }))}
                  />
                </ul>
              </PersonCard>
            </li>
          ))}
        </Gallery>
      </section>
    </>
  );
}
