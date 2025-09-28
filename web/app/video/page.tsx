import { BucketManager } from "@/lib/data/bucket";
import VideoFeedPage from "./VideoFeedPage";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const revalidate = false;

export default async function Home() {
  const feed = await BucketManager.getVideoFeed();

  return (
    <VideoFeedPage
      feed={feed}
      basePath="/video"
      currentPage={1}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  );
}
