import { PartialMedia, Person } from "@/lib/backend/types";
import { slugify } from "@/lib/utils";
import Link from "next/link";

function getTitle(media: PartialMedia) {
  return media.title || media.name || null;
}

export default async function Meilleurs({
  medias,
}: {
  medias: {
    movie: PartialMedia;
    personnalites: {
      person: Person;
      videos: Set<string>;
    }[];
  }[];
}) {
  medias.sort((a, b) => b.personnalites.length - a.personnalites.length);
  return (
    <ol>
      {medias.map((item, key) => {
        const title = getTitle(item.movie) || "Sans titre";
        const url =
          item.movie.media_type === "movie"
            ? `/film/${item.movie.id}`
            : `/serie/${item.movie.id}`;
        return (
          <li key={key}>
            <Link href={url}>
              <h1>{title}</h1>
            </Link>
            <ul>
              {Array.from(item.personnalites).map((p, k) => {
                return (
                  <li key={k}>
                    <p>{p.person.name}</p>
                    <ul>
                      {Array.from(p.videos).map((video) => {
                        return (
                          <li key={video}>
                            <Link
                              href={`/video/${video}#${slugify(item.movie.name || item.movie.title || "")}`}
                            >
                              lien
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
