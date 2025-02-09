import { BucketManager } from "@/lib/data/bucket";
import styles from "./page.module.css";
import VideoThumbnail from "@/components/videoThumbnail";

export default async function Home() {
  const videos = await BucketManager.getVideosSorted();

  return (
    <main className={styles.videoContainer}>
      {videos.map((video, index) => {
        return <VideoThumbnail key={index} video={video}/>
      })}
    </main>
  );
}
