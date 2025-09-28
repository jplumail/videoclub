import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "../meilleurs";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const revalidate = false;

export default async function Page() {
  const medias = await BucketManager.getBestMedia("film");
  return (
    <Meilleurs
      medias={medias}
      basePath="/meilleurs"
      currentPage={1}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  );
}
