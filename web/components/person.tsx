import { Person } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import { MoviesSet } from "@/lib/data/bucket";
import Image from "next/image";
import { MovieCard } from "./MovieCard";
import Link from "next/link";

export async function PersonComponent({
  personData,
}: {
  personData: {
    personnalite: {
      person: Person;
      videos: Set<string>;
    };
    movies: MoviesSet;
  };
}) {
  const person = personData.personnalite.person;
  const profilePicture = person.profile_path
    ? await ConfigurationManager.getProfileUrl(person.profile_path)
    : null;
  return (
    <div>
      <h1>{person.name}</h1>
      {profilePicture && (
        <Image
          alt={`Photo de ${person.name}`}
          src={profilePicture.url}
          width={profilePicture.width}
          height={profilePicture.height}
        />
      )}
      <h2>Vidéos</h2>
      <ul>
        {Array.from(personData.personnalite.videos).map((videoId, key) => {
          return (
            <li key={key}>
              <Link href={`/video/${videoId}`}>{videoId}</Link>
            </li>
          );
        })}
      </ul>
      <h2>Films cités</h2>
      <ul>
        {personData.movies.values().map((movie) => (
          <li key={movie.id}>
            <MovieCard media={movie} />
          </li>
        ))}
      </ul>
    </div>
  );
}
