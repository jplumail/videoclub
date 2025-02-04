import { PartialMedia, Person } from "@/lib/backend/types";
import { slugify } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import styles from "./movieDetails.module.css";
import { MovieCard } from "./MovieCard";

export function MovieDetails({
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
              <Image src="/tmdb.svg" alt="TMDB Logo" width={190.24} height={81.52} />
            </a>
          </div>
        </div>
      </div>

      <ul>
        {movie.personnalites.map((personnalite, index) => (
          <li key={index}>
            <Link href={`/personne/${personnalite.person.id}`}>
              {personnalite.person.name}
            </Link>
            {Array.from(personnalite.videos).map((videoId, key) => {
              return (
                <Link
                  key={key}
                  href={`/video/${videoId}#${slugify(movie.movie.name || movie.movie.title || "")}`}
                >
                  <p>{videoId}</p>
                </Link>
              );
            })}
          </li>
        ))}
      </ul>
    </main>
  );
}
