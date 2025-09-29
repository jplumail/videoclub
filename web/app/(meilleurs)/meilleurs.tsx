import { BestMediaData } from "@/lib/backend/types";
import { ConfigurationManager, type ImageUrl } from "@/lib/data/tmdb";
import BestMediaClient from "./BestMediaClient";

const DEFAULT_BATCH_SIZE = 24;

export type BestMediaSerializableItem = {
  id: string;
  media: BestMediaData["media"][number]["media"];
  citations: BestMediaData["media"][number]["citations"];
  poster: ImageUrl | null | undefined;
};

export default async function Meilleurs({
  medias,
  batchSize = DEFAULT_BATCH_SIZE,
}: {
  medias: BestMediaData;
  batchSize?: number;
}) {
  const sorted = [...medias.media].sort(
    (a, b) => b.citations.length - a.citations.length,
  );

  const enhanced: BestMediaSerializableItem[] = await Promise.all(
    sorted.map(async (item, index) => {
      const type = item.media.type === "tv" ? "tv" : "movie";
      const poster = await ConfigurationManager.getPosterUrlById(
        type,
        item.media.id ?? null,
      );
      const id = item.media.id ?? `idx-${index}`;
      return {
        id: `${item.media.type}-${id}`,
        media: item.media,
        citations: item.citations,
        poster: poster ?? null,
      };
    }),
  );

  return <BestMediaClient items={enhanced} batchSize={batchSize} />;
}
