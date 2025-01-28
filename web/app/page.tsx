"use server";

import { BucketManager } from "@/lib/data";
import { slugify } from "@/lib/utils";
import Image from "next/image";

export default async function Home() {
  const videos = await BucketManager.getVideosSorted();

  return (
    <main>
      {videos.map((video, index) => {
        const videoUrl = `/video/${slugify(video.playlist_item.snippet.title)}_${
          video.playlist_item.snippet.resourceId.videoId
        }`;
        const personnes = video.personnalites.filter((p) => p !== null);
        return (
          <div key={index}>
            <a href={videoUrl}>
              <Image
                src={video.playlist_item.snippet.thumbnails.standard.url}
                width={video.playlist_item.snippet.thumbnails.standard.width}
                height={video.playlist_item.snippet.thumbnails.standard.height}
                alt="thumbnail"
              />
            </a>
            <h2>
              <a href={videoUrl}>{video.playlist_item.snippet.title}</a>
            </h2>
            {personnes.length > 0 &&
              personnes.map((p) => {
                return (
                  <a href={`/personne/${p.id}`}>
                    <p>{p.name}</p>
                  </a>
                );
              })}
          </div>
        );
      })}
    </main>
  );
}
