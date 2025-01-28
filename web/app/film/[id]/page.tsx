import { Film } from "@/components/film";
import { BucketManager } from "@/lib/data";

export async function generateStaticParams() {
  const allMovies = await BucketManager.getMediaByPersonnalites();
  return allMovies
    .filter((movie) => movie.movie.media_type == "movie")
    .map((movie) => ({
      id: movie.movie.id?.toString(),
    }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const movieId = (await params).id;
  const medias = await BucketManager.getMediaByPersonnalites();
  const movie = medias.find(
    (media) =>
      media.movie.media_type == "movie" &&
      media.movie.id?.toString() == movieId,
  );
  return movie && <Film movie={movie}></Film>;
}
