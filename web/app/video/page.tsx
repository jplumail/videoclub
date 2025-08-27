import { BucketManager } from "@/lib/data/bucket";
import styles from "./page.module.css";
import VideoThumbnail from "@/components/videoThumbnail";

export default async function Home() {
  const feed = await BucketManager.getVideoFeed();
  const videos = [...feed.feed].sort(
    (a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
  );

  return (
    <main className={styles.videoContainer}>
      {videos.map((video, index) => {
        return <VideoThumbnail key={index} video={video}/>
      })}
    </main>
  );
}
