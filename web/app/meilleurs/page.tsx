import { BucketManager } from "@/lib/data";
import Meilleurs from "@/components/meilleurs";

export default async function Page() {
  const medias = await BucketManager.getMediaTimestampsSorted();
  return <Meilleurs medias={medias} />;
}
