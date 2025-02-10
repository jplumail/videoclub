import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "../../meilleurs";

export default async function Page() {
  const medias = await BucketManager.getMediaTimestampsSorted({
    media_type: "movie",
  });
  return <Meilleurs medias={medias} />;
}
