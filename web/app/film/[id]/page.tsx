import { PartialMedia, Person } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data";
import { slugify } from "@/lib/utils";

export async function generateStaticParams() {
  const allMovies = await BucketManager.getMediaByPersonnalites();
  return allMovies
    .filter((movie) => movie.movie.media_type == "movie")
    .map((movie) => ({
      id: movie.movie.id?.toString(),
    }));
}

function Film({
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
            <a href={`/personne/${personnalite.person.id}`}>
              {personnalite.person.name}
            </a>
            {Array.from(personnalite.videos).map((videoId, key) => {
              return (
                <a
                  key={key}
                  href={`/video/${videoId}#${slugify(movie.movie.name || movie.movie.title || "")}`}
                >
                  <p>{videoId}</p>
                </a>
              );
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const movieId = (await params).id;
  const medias = await BucketManager.getMediaByPersonnalites();
  const movie = medias.find((media) => media.movie.id?.toString() == movieId);
  return movie && <Film movie={movie}></Film>;
}
