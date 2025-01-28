import { BucketManager } from "@/lib/data";
import { Film } from "@/components/film";

export async function generateStaticParams() {
  const allMovies = await BucketManager.getMediaByPersonnalites();
  return allMovies
    .filter((movie) => movie.movie.media_type == "tv")
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
      media.movie.media_type == "tv" && media.movie.id?.toString() == movieId,
  );
  return movie && <Film movie={movie}></Film>;
}
