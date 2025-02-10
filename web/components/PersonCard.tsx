import { Person } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import Image from "next/image";
import Link from "next/link";
import styles from "./Card.module.css";
import { Card } from "./Card";

export interface ProfileProps {
  person: Person;
}

export async function Profile({ person }: ProfileProps) {
  const profile = person.profile_path
    ? await ConfigurationManager.getProfileUrl(person.profile_path)
    : undefined;
  const name = person.name || "";
  const id = person.id || 0;
  const href = `/personne/${id}`;

  return (
    <Link href={href} className={styles.link}>
      {profile && (
        <Image
          src={profile.url}
          alt={`Photo de ${name}`}
          width={profile.width}
          height={profile.height}
        />
      )}
    </Link>
  );
}

interface PersonCardProps {
  person: Person;
  profile?: React.ReactElement<ProfileProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

export async function PersonCard({
  person,
  children,
  profile,
  hasDetails = true,
}: PersonCardProps) {
  const defaultProfile = <Profile person={person} />;
  const name = person.name || "";
  const id = person.id || 0;
  const href = `/personne/${id}`;

  return (
    <Card
      item={person}
      href={href}
      title={name}
      media={profile || defaultProfile}
      hasDetails={hasDetails}
    >
      {children}
    </Card>
  );
}
