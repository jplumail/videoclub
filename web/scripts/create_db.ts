import { PartialMedia, Person } from "@/lib/backend/types";
import { BucketManager } from "@/lib/data";
import { Storage, Bucket } from "@google-cloud/storage";

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

async function uploadWithRetry(
  bucket: Bucket,
  jsonString: string,
  path: string,
) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await bucket.file(path).save(jsonString, {
        contentType: "application/json",
        timeout: 30000, // 30 seconds timeout
      });
      console.log(`Successfully uploaded ${path} on attempt ${attempt + 1}`);
      return;
    } catch (error) {
      const delay = INITIAL_DELAY * Math.pow(2, attempt);
      console.error(`Upload attempt ${attempt + 1} failed:`, error);

      if (attempt === MAX_RETRIES - 1) {
        throw new Error(
          `Failed to upload after ${MAX_RETRIES} attempts: ${error}`,
        );
      }

      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function convertItemToJSON(item: {
  movie: PartialMedia;
  personnalites: {
    person: Person;
    videos: Set<string>;
  }[];
}) {
  return {
    movie: item.movie,
    personnalites: item.personnalites.map((x) => {
      return { person: x.person, videos: Array.from(x.videos) };
    }),
  };
}

async function exportMediaByPersonnalites() {
  const media = await BucketManager.createMediaByPersonnalites();
  const jsonString = JSON.stringify(
    media.map((m) => {
      return convertItemToJSON(m);
    }),
  );
  await BucketManager.getBucket()
    .file("mediaByPersonnalites.json")
    .save(jsonString);

  // Save each movie in a separate file
  const uploadPromises = media.map(async (m) => {
    const jsonString = JSON.stringify(convertItemToJSON(m));
    let filePath: string;
    if (m.movie.media_type == "movie") {
      filePath = `mediaByPersonnalites/movie/${m.movie.id}.json`;
    } else {
      filePath = `mediaByPersonnalites/tv/${m.movie.id}.json`;
    }
    return uploadWithRetry(BucketManager.getBucket(), jsonString, filePath);
  });
  await Promise.all(uploadPromises);
}

async function exportPersonnalitesByMedia() {
  const personnes = await BucketManager.createPersonnalitesByMovies();
  const jsonData = personnes.map((p) => {
    return {
      personnalite: {
        person: p.personnalite.person,
        videos: Array.from(p.personnalite.videos),
      },
      movies: p.movies.values(),
    };
  });
  await BucketManager.getBucket()
    .file("personnalitesByMedia.json")
    .save(JSON.stringify(jsonData));

  // Save each person in a separate file
  const uploadPromises = personnes.map(async (p) => {
    const jsonString = JSON.stringify({
      personnalite: {
        person: p.personnalite.person,
        videos: Array.from(p.personnalite.videos),
      },
      movies: Array.from(p.movies.values()),
    });
    const filePath = `personnalitesByMedia/${p.personnalite.person.id}.json`;
    return uploadWithRetry(BucketManager.getBucket(), jsonString, filePath);
  });
  await Promise.all(uploadPromises);
}

async function exportMediaTimestampsSorted() {
  const mediasTimestamps = await BucketManager.createMediaTimestampsSorted();
  return uploadWithRetry(
    BucketManager.getBucket(),
    JSON.stringify(mediasTimestamps),
    BucketManager.mediaPersonTimestampsSortedPath,
  );
}

async function exportDB() {
  await exportMediaByPersonnalites();
  await exportPersonnalitesByMedia();
  await exportMediaTimestampsSorted();
}

exportDB().catch(console.error);
