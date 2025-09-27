import { PersonneIdData } from "@/lib/backend/types";
import { MovieCard } from "@/components/MovieCard";
import MovieCardDetails from "@/components/MovieCardDetails";
import Gallery from "@/components/Gallery";
import { slugify } from "@/lib/utils";
import ytIconStyle from "@/components/styles/yt-icon.module.css";
import VideoThumbnail from "@/components/videoThumbnail";

export async function PersonComponent({
  personData,
}: {
  personData: PersonneIdData;
}) {
  const person = { name: personData.name };
  return (
    <>
      <h1>{person.name} </h1>
      <section>
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
            <Gallery>
              {personData.videos.map((v, key) => (
                <li key={key}>
                  <VideoThumbnail video={v} />
                </li>
              ))}
            </Gallery>
          </div>
        </div>
      </section>
      <section>
        <h2>Films cités</h2>
        <Gallery>
          {personData.citations.map((c, idx) => (
            <li key={idx}>
              {(() => {
                const first = c.citations[0];
                const href = first
                  ? `/video/${first.videoId}#${slugify(c.media.title || "")}`
                  : "#";
                return (
                  <MovieCard media={c.media} hasDetails={false} hrefOverride={href} />
                );
              })()}
            </li>
          ))}
        </Gallery>
      </section>
    </>
  );
}
