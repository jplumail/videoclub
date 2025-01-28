import { PersonComponent } from "@/components/person";
import { BucketManager } from "@/lib/data";

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
    id: personneId,
  });
  return personne && <PersonComponent personData={personne} />;
}
