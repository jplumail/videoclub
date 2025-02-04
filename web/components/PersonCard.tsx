import { Person } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import Image from "next/image";
import Link from "next/link";
import styles from "./MovieCard.module.css"; // Réutilisation des styles de MovieCard

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

interface PersonCardBaseProps {
  person: Person;
  profile?: React.ReactElement<ProfileProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
}

function PersonCardBase({
  person,
  profile,
  children,
  hasDetails = true,
}: PersonCardBaseProps) {
  const name = person.name || "";
  const id = person.id || 0;
  const href = `/personne/${id}`;

  return (
    <div className={styles.container}>
      {profile}
      {hasDetails && (
        <div className={styles.children}>
          {children}
          <p className={styles.movieDetails}>
            <Link href={href} className={styles.details}>
              <span className={styles.title}>{name}</span>
            </Link>
          </p>
        </div>
      )}
    </div>
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
  return (
    <PersonCardBase
      person={person}
      profile={profile || defaultProfile}
      hasDetails={hasDetails}
    >
      {children}
    </PersonCardBase>
  );
}
