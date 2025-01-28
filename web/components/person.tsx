import { Person } from "@/lib/backend/types";
import { ConfigurationManager, MoviesSet } from "@/lib/data";
import Image from "next/image";

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
              <a href={`/video/${videoId}`}>{videoId}</a>
            </li>
          );
        })}
      </ul>
      <h2>Films cités</h2>
      <ul>
        {personData.movies.values().map((movie) => (
          <li key={movie.id}>
            <a
              href={
                movie.media_type == "movie"
                  ? `/film/${movie.id}`
                  : `/serie/${movie.id}`
              }
            >
              {movie.title || movie.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
