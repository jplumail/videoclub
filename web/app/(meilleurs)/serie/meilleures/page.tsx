import { BucketManager } from "@/lib/data/bucket";
import Meilleurs from "../../meilleurs";

export default async function Page() {
  const medias = await BucketManager.getBestMedia("serie");
  return <Meilleurs medias={medias} />;
}
