import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "@/components/meilleurs";

export default async function Page() {
  const medias = await BucketManager.getMediaTimestampsSorted();
  return <Meilleurs medias={medias} />;
}
