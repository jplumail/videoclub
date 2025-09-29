import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "../../meilleurs";

export default async function Page() {
  const medias = await BucketManager.getBestMedia("film");
  return <Meilleurs medias={medias} />;
}
