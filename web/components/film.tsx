import { PartialMedia, Person } from "@/lib/backend/types";
import { slugify } from "@/lib/utils";
import Link from "next/link";

export function Film({
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
    <div>
      <h1>{movie.movie.name}</h1>
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
    </div>
  );
}
