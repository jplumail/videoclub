import { BucketManager } from "@/lib/data/bucket";
import { MovieDetails } from "../../movieDetails";

export async function generateStaticParams() {
  const index = await BucketManager.getIndex("serie");
  return index.ids.map((id) => ({ id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const movieId = (await params).id;
  const movie = await BucketManager.getMediaById("serie", movieId);
  return movie && <MovieDetails movie={movie} kind="serie" />;
}
