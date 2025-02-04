import { PartialMedia, Person, TimeOffset } from "@/lib/backend/types";
import { getYoutubeUrl, slugify } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import styles from "./movieDetails.module.css";
import meilleursStyles from "./meilleurs.module.css";
import ytIconStyle from "./yt-icon.module.css";
import { MovieCard } from "./MovieCard";
import { PersonCard } from "./PersonCard";
import { BucketManager } from "@/lib/data/bucket";

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
              const firstMovie = movies ? movies[0] : null;
              const video = await BucketManager.getVideos({ videoId });
              if (firstMovie) {
                return {
                  videoId: videoId,
                  timestamp: firstMovie.start_time,
                  title: video.playlist_item.snippet.title,
                };
              }
            }),
          )
        ).filter((v) => v !== undefined),
      })),
    ),
  };
  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1>{movie.movie.title || movie.movie.name}</h1>
      </div>

      <div className={styles.mainContent}>
        <MovieCard media={movie.movie} hasDetails={false} />
        <div>
          <p className={styles.description}>{movie.movie.overview}</p>
          <div className={styles.tmdbButtonWrapper}>
            <a
              href={`https://www.themoviedb.org/movie/${movie.movie.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.tmdbButton}
            >
              <Image
                src="/tmdb.svg"
                alt="TMDB Logo"
                width={190.24}
                height={81.52}
              />
            </a>
          </div>
        </div>
      </div>

      <h2 className={styles.citationTitle}>Cité par :</h2>
      <ul>
        {movieWithTimestamp.personnalites.map((personnalite, index) => (
          <li key={index}>
            <PersonCard person={personnalite.person}>
              <ul className={meilleursStyles.citeList}>
                {Array.from(personnalite.videos).map((video, key) => {
                  return (
                    <li key={key} className={meilleursStyles.citeItem}>
                      <p>
                        <Link
                          href={`/video/${video.videoId}#${slugify(movie.movie.name || movie.movie.title || "")}`}
                        >
                          {video.title}
                        </Link>
                      </p>
                      <div>
                        <Link
                          key={video.videoId}
                          href={getYoutubeUrl(
                            video.videoId,
                            video.timestamp.seconds || null,
                          )}
                          className={`${meilleursStyles.link} ${ytIconStyle.ytIcon}`}
                          target="_blank"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </PersonCard>
          </li>
        ))}
      </ul>
    </main>
  );
}
