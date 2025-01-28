import { BucketManager } from "@/lib/data";
import Meilleurs from "@/components/meilleurs";

export default async function Page() {
  const medias = await BucketManager.getMediaByPersonnalites({
    media_type: "movie",
  });
  return <Meilleurs medias={medias} />;
}
