import { BucketManager } from "@/lib/data/bucket";
import { Film } from "@/components/film";

export async function generateStaticParams() {
  const allMovies = await BucketManager.getMediaByPersonnalites({
    media_type: "tv",
  });
  return allMovies.map((movie) => ({
    id: movie.movie.id?.toString(),
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const movieId = (await params).id;
  const movie = await BucketManager.getMediaByPersonnalites({
    id: movieId,
    media_type: "tv",
  });
  return movie && <Film movie={movie}></Film>;
}
