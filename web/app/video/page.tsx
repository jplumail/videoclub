import { BucketManager } from "@/lib/data";
import Image from "next/image";
import styles from "./page.module.css";
import Link from "next/link";

export default async function Home() {
  const videos = await BucketManager.getVideosSorted();

  return (
    <main className={styles.videoContainer}>
      {videos.map((video, index) => {
        const videoUrl = `/video/${video.playlist_item.snippet.resourceId.videoId}`;
        const personnes = video.personnalites.filter((p) => p !== null);
        return (
          <Link key={index} className={styles.video} href={videoUrl}>
            <div className={styles.thumbnail}>
              <Image
                src={video.playlist_item.snippet.thumbnails.standard.url}
                width={video.playlist_item.snippet.thumbnails.standard.width}
                height={video.playlist_item.snippet.thumbnails.standard.height}
                alt="thumbnail"
              />
            </div>
            <h2>
              <Link href={videoUrl}>{video.playlist_item.snippet.title}</Link>
            </h2>
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
          </Link>
        );
      })}
    </main>
  );
}
