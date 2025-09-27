import { Personnalite } from "@/lib/backend/types";
import { ConfigurationManager } from "@/lib/data/tmdb";
import Link from "next/link";
import Image from "next/image";
import styles from "./styles/Card.module.css";
import { Card } from "./Card";

export interface ProfileProps {
  person: Personnalite;
}

export async function Profile({ person }: ProfileProps) {
  const name = person.name || "";
  const id = person.person_id || 0;
  const href = `/personne/${id}`;
  const profile = await ConfigurationManager.getProfileUrlById(person.person_id ?? null);
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
  person: Personnalite;
  profile?: React.ReactElement<ProfileProps>;
  children?: React.ReactNode;
  hasDetails?: boolean;
  hrefOverride?: string;
  badgeText?: string;
}

export async function PersonCard({
  person,
  children,
  profile,
  hasDetails = true,
  hrefOverride,
  badgeText,
}: PersonCardProps) {
  // If we're delegating click to Card via hrefOverride and turning off details,
  // render the profile image without its own Link to avoid nested links.
  let mediaEl: React.ReactElement;
  if (!hasDetails && hrefOverride) {
    const profileUrl = await ConfigurationManager.getProfileUrlById(
      person.person_id ?? null,
    );
    mediaEl = (
      <div className={styles.link}>
        {profileUrl && (
          <Image
            src={profileUrl.url}
            alt={`Photo de ${person.name || ""}`}
            width={profileUrl.width}
            height={profileUrl.height}
          />
        )}
      </div>
    );
  } else {
    mediaEl = profile || <Profile person={person} />;
  }
  return (
    <Card
      item={person}
      media={mediaEl}
      hasDetails={hasDetails}
      hrefOverride={hrefOverride}
      badgeText={badgeText}
    >
      {children}
    </Card>
  );
}
