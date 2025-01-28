import { PartialMedia, Person } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data";

function getTitle(media: PartialMedia) {
  return media.title || media.name || null;
}

export default async function Meilleurs({
  medias,
}: {
  medias: {
    movie: PartialMedia;
    personnalites: Person[];
  }[];
}) {
  medias.sort((a, b) => b.personnalites.length - a.personnalites.length);
  return (
    <div>
      {medias.map((item, key) => {
        const title = getTitle(item.movie) || "Sans titre";
        const url =
          item.movie.media_type === "movie"
            ? `/movie/${item.movie.id}`
            : `/tv/${item.movie.id}`;
        return (
          <div key={key}>
            <a href={url}>
              <h1>{title}</h1>
            </a>
            <ul>
              {Array.from(item.personnalites).map((p, k) => {
                return <li key={k}>{p.name}</li>;
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
