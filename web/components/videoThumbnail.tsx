import { PlaylistItemPersonnalites } from "@/lib/backend/types";
import Link from "next/link";
import Image from "next/image";
import styles from "./videoThumbnail.module.css";

export default async function VideoThumbnail({
  video,
  details,
}: {
  video: PlaylistItemPersonnalites;
  details?: boolean;
}) {
  const videoUrl = `/video/${video.playlist_item.snippet.resourceId.videoId}`;
  const personnes = video.personnalites.filter((p) => p !== null);
  return (
    <div className={styles.video}>
      <Link href={videoUrl}>
        <div className={styles.thumbnail}>
          <Image
            src={video.playlist_item.snippet.thumbnails.standard.url}
            width={video.playlist_item.snippet.thumbnails.standard.width}
            height={video.playlist_item.snippet.thumbnails.standard.height}
            alt="thumbnail"
          />
        </div>
      </Link>
      <h2>
        <Link href={videoUrl}>{video.playlist_item.snippet.title}</Link>
      </h2>
      {details && (
        <div className={styles.additionalInfo}>
          <div className={styles.personnesContainer}>
            {personnes.length > 0 &&
              personnes.map((p, key) => {
                return (
                  <div key={key} className={styles.personne}>
                    <Link href={`/personne/${p.id}`}>{p.name}</Link>
                    {key < personnes.length - 2 && ", "}
                    {key === personnes.length - 2 && " et "}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
