import { BucketManager } from "@/lib/data";
import Meilleurs from "@/components/meilleurs";

export default async function Page() {
  let medias = await BucketManager.getMediaByPersonnalites({
    media_type: "tv",
  });
  return <Meilleurs medias={medias} />;
}
