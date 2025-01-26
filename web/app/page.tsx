"use server";

import { BucketManager } from "@/lib/data";
import Image from "next/image";

function convertTitleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function Home() {
  const videos = await BucketManager.getVideosSorted();

  return (
    <main>
      {videos.map((video, index) => {
        const videoUrl = `/video/${convertTitleToSlug(video.snippet.title)}_${
          video.snippet.resourceId.videoId
        }`;
        return (
          <div key={index}>
            <a href={videoUrl}>
              <Image
                src={video.snippet.thumbnails.standard.url}
                width={video.snippet.thumbnails.standard.width}
                height={video.snippet.thumbnails.standard.height}
                alt="thumbnail"
              />
            </a>
            <h2>
              <a href={videoUrl}>{video.snippet.title}</a>
            </h2>
          </div>
        );
      })}
    </main>
  );
}
