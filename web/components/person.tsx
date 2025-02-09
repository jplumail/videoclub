import { PartialMedia, Person, TimeOffset } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import { BucketManager, MoviesSet } from "@/lib/data/bucket";
import { MovieCard } from "./MovieCard";
import VideoThumbnail from "./videoThumbnail";
import MovieCardDetails from "./MovieCardDetails";
import Gallery from "./Gallery";
import { slugify } from "@/lib/utils";
import { PersonCard } from "./PersonCard";
import ytIconStyle from "./yt-icon.module.css";

export async function PersonComponent({
  personData,
}: {
  personData: {
    personnalite: {
      person: Person;
      videos: Set<string>;
    };
    movies: {
      movie: PartialMedia;
      timestamps: {
        videoId: string;
        timestamp: TimeOffset;
      }[];
    }[];
  };
}) {
  const person = personData.personnalite.person;
  const profilePicture = person.profile_path
    ? await ConfigurationManager.getProfileUrl(person.profile_path)
    : null;
  return (
    <>
      <section>
        <h1>{person.name} </h1>
        <div>
          <div>
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              Vidéos <div className={ytIconStyle.ytIcon} />
            </h2>
            <ul>
              {Array.from(personData.personnalite.videos).map(
                async (videoId, key) => {
                  const videoItem = await BucketManager.getVideos({
                    videoId,
                  });
                  return (
                    <VideoThumbnail
                      key={key}
                      video={videoItem}
                      details={false}
                    />
                  );
                },
              )}
            </ul>
          </div>
        </div>
      </section>
      <section>
        <h2>Films cités</h2>
        <Gallery>
          {await Promise.all(
            Array.from(personData.movies.values()).map(async (movie) => {
              return (
                <li key={movie.movie.id}>
                  <MovieCard media={movie.movie}>
                    <MovieCardDetails
                      items={await Promise.all(
                        movie.timestamps.map(async (t) => ({
                          main: {
                            title: await BucketManager.getVideos({
                              videoId: t.videoId,
                            }).then((v) => v.playlist_item.snippet.title),
                            href: `/video/${t.videoId}#${slugify(movie.movie.title || movie.movie.name || "")}`,
                          },
                          youtubeUrls: [
                            {
                              videoId: t.videoId,
                              timestamp: t.timestamp,
                            },
                          ],
                        })),
                      )}
                    />
                  </MovieCard>
                </li>
              );
            }),
          )}
        </Gallery>
      </section>
    </>
  );
}
