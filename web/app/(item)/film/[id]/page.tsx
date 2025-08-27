import { MovieDetails } from "../../movieDetails";
import { BucketManager } from "@/lib/data/bucket";
export async function generateStaticParams() {
  const index = await BucketManager.getIndex("film");
  return index.ids.map((id) => ({ id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const movieId = (await params).id;
  const movie = await BucketManager.getMediaById("film", movieId);
  return movie && <MovieDetails movie={movie} kind="film" />;
}
