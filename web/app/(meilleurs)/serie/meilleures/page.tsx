import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "../../meilleurs";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const revalidate = false;

export default async function Page() {
  const medias = await BucketManager.getBestMedia("serie");
  return (
    <Meilleurs
      medias={medias}
      basePath="/serie/meilleures"
      currentPage={1}
      pageSize={DEFAULT_PAGE_SIZE}
    />
  );
}
