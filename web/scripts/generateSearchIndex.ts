import path from "node:path";
import { promises as fs } from "node:fs";
import Fuse from "fuse.js";
import { BucketManager } from "@/lib/data/bucket";
import { ConfigurationManager } from "@/lib/data/tmdb";
import { MediaIdData, PersonneIdData } from "@/lib/backend/types";

type SearchKind = "film" | "serie" | "personne";

interface BaseDocument {
  id: string;
  kind: SearchKind;
  title: string;
  url: string;
  metadata?: {
    releaseYear?: string | null;
    director?: string | null;
  };
}

async function getDirector(kind: "film" | "serie", media: MediaIdData) {
  const tmdbType = kind === "film" ? "movie" : "tv";
  try {
    return await ConfigurationManager.getDirectorById(tmdbType, media.id);
  } catch (error) {
    console.warn(
      `Failed to fetch director for ${kind} ${media.id}:`,
      (error as Error)?.message ?? error,
    );
    return null;
  }
}

async function getMediaDocuments(
  kind: "film" | "serie",
): Promise<BaseDocument[]> {
  console.log(`Fetching ${kind} documents...`);
  const index = await BucketManager.getIndex(kind);
  console.log(`Found ${index.ids.length} ${kind} IDs in index.`);
  const documents: BaseDocument[] = [];

  const chunkSize = 32;

  for (let start = 0; start < index.ids.length; start += chunkSize) {
    const idsChunk = index.ids.slice(start, start + chunkSize);
    const chunkDocuments = await Promise.all(
      idsChunk.map(async (id) => {
        const media: MediaIdData = await BucketManager.getMediaById(kind, id);
        if (!media || !media.title) return null;
        const director = await getDirector(kind, media);
        return {
          id,
          kind,
          title: media.title,
          url: `/${kind}/${id}`,
          metadata: {
            releaseYear: media.release_year,
            director,
          },
        } satisfies BaseDocument;
      }),
    );

    for (const doc of chunkDocuments) {
      if (doc) documents.push(doc);
    }

    const processed = Math.min(start + idsChunk.length, index.ids.length);
    console.log(`  ${kind}: processed ${processed}/${index.ids.length}`);
  }

  return documents;
}

async function getPeopleDocuments(): Promise<BaseDocument[]> {
  console.log("Fetching personne documents...");
  const index = await BucketManager.getIndex("personne");
  console.log(`Found ${index.ids.length} personne IDs in index.`);
  const documents: BaseDocument[] = [];

  const chunkSize = 32;

  for (let start = 0; start < index.ids.length; start += chunkSize) {
    const idsChunk = index.ids.slice(start, start + chunkSize);
    const chunkDocuments = await Promise.all(
      idsChunk.map(async (id) => {
        const person: PersonneIdData = await BucketManager.getPersonById(id);
        if (!person || !person.name) return null;
        return {
          id,
          kind: "personne" as const,
          title: person.name,
          url: `/personne/${id}`,
        } satisfies BaseDocument;
      }),
    );

    for (const doc of chunkDocuments) {
      if (doc) documents.push(doc);
    }

    const processed = Math.min(start + idsChunk.length, index.ids.length);
    console.log(`  personne: processed ${processed}/${index.ids.length}`);
  }

  return documents;
}

async function ensureOutputDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJSON(filePath: string, data: unknown) {
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, "utf-8");
}

async function main() {
  console.log("Generating search index...");
  const [films, series, people] = await Promise.all([
    getMediaDocuments("film"),
    getMediaDocuments("serie"),
    getPeopleDocuments(),
  ]);

  const documents = [...films, ...series, ...people];

  const fuseKeys = ["title"] as const;
  console.log(
    `Indexing ${documents.length} documents with keys: ${fuseKeys.join(", ")}`,
  );
  const fuseIndex = Fuse.createIndex(fuseKeys, documents);

  const publicDir = path.join(process.cwd(), "public");
  await ensureOutputDirectory(publicDir);

  const outputPath = path.join(publicDir, "search-index.json");
  console.log(`Writing search index to ${outputPath}...`);
  await writeJSON(outputPath, {
    generatedAt: new Date().toISOString(),
    documents,
    fuse: {
      keys: fuseKeys,
      index: fuseIndex.toJSON(),
    },
  });

  console.log(
    `Generated ${documents.length} search documents at ${outputPath}.`,
  );
}

main().catch((error) => {
  console.error("Failed to generate search index:", error);
  process.exit(1);
});
