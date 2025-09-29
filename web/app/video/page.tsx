import { BucketManager } from "@/lib/data/bucket";
import VideoFeedClient from "./VideoFeedClient";

export default async function Home() {
  const feed = await BucketManager.getVideoFeed();

  return (
    <VideoFeedClient
      videos={[...feed.feed].sort(
        (a, b) =>
          new Date(b.release_date).getTime() -
          new Date(a.release_date).getTime(),
      )}
    />
  );
}
