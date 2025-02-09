import { PersonComponent } from "@/components/person";
import { MediaItemTimestamp, TimeOffset } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data/bucket";

export async function generateStaticParams() {
  const allPersonnes = await BucketManager.getPersonnalitesByMedia();
  return allPersonnes.map((p) => ({
    id: p.personnalite.person.id?.toString(),
  }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const personneId = (await params).id;
  const personne = await BucketManager.getPersonnalitesByMedia({
    personId: personneId,
  });
  const movies = await Promise.all(
    Array.from(personne.personnalite.videos).map(async (videoId) => ({
      moviesVideo: await BucketManager.getMovies(videoId),
      videoId: videoId,
    })),
  );
  const personneWithTimestamps = {
    personnalite: personne.personnalite,
    movies: personne.movies.values().map((movie) => {
      let matchingMovies: {
        videoId: string;
        timestamp: TimeOffset;
      }[] = [];
      movies.forEach(({ moviesVideo, videoId }) => {
        if (moviesVideo) {
          const matchingMoviesVideo = moviesVideo.filter(
            (m) =>
              m.media_item.details.media_type == movie.media_type &&
              m.media_item.details.id == movie.id,
          );
          if (matchingMoviesVideo.length > 0) {
            matchingMovies.push({videoId: videoId, timestamp: matchingMoviesVideo[0].start_time});
          }
        }
      });
      return {
        movie: movie,
        timestamps: matchingMovies,
      };
    }),
  };
  return personne && <PersonComponent personData={personneWithTimestamps} />;
}
