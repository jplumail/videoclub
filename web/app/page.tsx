"use server";

import { Storage } from '@google-cloud/storage';

function convertTitleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface VideoData {
  snippet: {
    publishedAt: string;
    title: string;
    videoId: string;
    thumbnails: {
      standard: {
        url: string;
        width: number;
        height: number;
      };
    };
    resourceId: {
      videoId: string;
    }
  }
}

export default async function Home() {
  const storage = new Storage();
  const bucket = storage.bucket('videoclub-test');

  const [files] = await bucket.getFiles({
    prefix: 'videos/',
  });

  const jsonFiles = files.filter(file => file.name.endsWith('video.json'));
  const videos: VideoData[] = [];

  for (const file of jsonFiles) {
    const [content] = await file.download();
    const videoData = JSON.parse(content.toString()) as VideoData;
    videos.push(videoData);
  }

  videos.sort((a, b) =>
    new Date(b.snippet.publishedAt).getTime() - new Date(a.snippet.publishedAt).getTime()
  );
  console.log(videos[2]);

  return (
    <main>
      {videos.map((video, index) => {
        const videoUrl = `/video/${convertTitleToSlug(video.snippet.title)}_${video.snippet.resourceId.videoId}`;
        return <div key={index}>
          <a href={videoUrl}><img src={video.snippet.thumbnails.standard.url} alt="thumbnail" /></a>
          <h2>
            <a href={videoUrl}>{video.snippet.title}</a>
          </h2>
        </div>
      })}
    </main>
  );
}
