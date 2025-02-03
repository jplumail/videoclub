import { Film } from "@/components/film";
import { BucketManager } from "@/lib/data/bucket";
export async function generateStaticParams() {
  const allMovies = await BucketManager.getMediaByPersonnalites({
    media_type: "movie",
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
    media_type: "movie",
  });
  return movie && <Film movie={movie}></Film>;
}
