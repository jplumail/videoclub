import { notFound } from "next/navigation";
import { BucketManager } from "@/lib/data/bucket";
import VideoFeedPage from "@/app/video/VideoFeedPage";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

type PageParams = {
  page: string;
};

export const revalidate = false;

function parsePageNumber(rawPage: string) {
  const value = Number.parseInt(rawPage, 10);
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const pageNumber = parsePageNumber(page);
  if (pageNumber === null || pageNumber < 2) {
    notFound();
  }

  const feed = await BucketManager.getVideoFeed();
  const totalPages = Math.max(
    1,
    Math.ceil(feed.feed.length / DEFAULT_PAGE_SIZE),
  );

  if (pageNumber > totalPages) {
    notFound();
  }

  return (
    <VideoFeedPage
      feed={feed}
      basePath="/video"
      currentPage={pageNumber}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  );
}

export async function generateStaticParams() {
  const feed = await BucketManager.getVideoFeed();
  const totalPages = Math.max(
    1,
    Math.ceil(feed.feed.length / DEFAULT_PAGE_SIZE),
  );

  const params: Array<PageParams> = [];
  for (let page = 2; page <= totalPages; page += 1) {
    params.push({ page: page.toString() });
  }
  return params;
}
