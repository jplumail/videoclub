import { VideoDataShort } from "@/lib/backend/types";
import Link from "next/link";
import Image from "next/image";
import styles from "./styles/videoThumbnail.module.css";

export default async function VideoThumbnail({
  video,
  details,
}: {
  video: VideoDataShort;
  details?: boolean;
}) {
  const videoUrl = `/video/${video.video_id}`;
  return (
    <div className={styles.video}>
      <Link href={videoUrl}>
        <div className={styles.thumbnail}>
          <Image
            src={`https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`}
            width={480}
            height={270}
            alt="thumbnail"
          />
        </div>
      </Link>
      <h2>
        <Link href={videoUrl}>{video.name}</Link>
      </h2>
      {details && <div className={styles.additionalInfo}></div>}
    </div>
  );
}
