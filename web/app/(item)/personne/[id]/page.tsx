import { PersonComponent } from "./person";
import { BucketManager } from "@/lib/data/bucket";

export async function generateStaticParams() {
  const index = await BucketManager.getIndex("personne");
  return index.ids.map((id) => ({ id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const personneId = (await params).id;
  const personne = await BucketManager.getPersonById(personneId);
  return personne && <PersonComponent personData={personne} />;
}
