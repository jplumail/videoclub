import { notFound } from "next/navigation";
import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "@/app/(meilleurs)/meilleurs";
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

  const medias = await BucketManager.getBestMedia("serie");
  const totalPages = Math.max(
    1,
    Math.ceil(medias.media.length / DEFAULT_PAGE_SIZE),
  );

  if (pageNumber > totalPages) {
    notFound();
  }

  return (
    <Meilleurs
      medias={medias}
      basePath="/serie/meilleures"
      currentPage={pageNumber}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  );
}

export async function generateStaticParams() {
  const medias = await BucketManager.getBestMedia("serie");
  const totalPages = Math.max(
    1,
    Math.ceil(medias.media.length / DEFAULT_PAGE_SIZE),
  );

  const params: Array<PageParams> = [];
  for (let page = 2; page <= totalPages; page += 1) {
    params.push({ page: page.toString() });
  }
  return params;
}
