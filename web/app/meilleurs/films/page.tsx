import { BucketManager } from "@/lib/data";
import Meilleurs from "@/components/meilleurs";

export default async function Page() {
  let medias = await BucketManager.getMediaByPersonnalites();
  medias = medias.filter((item) => item.movie.media_type === "movie");
  return <Meilleurs medias={medias} />;
}
