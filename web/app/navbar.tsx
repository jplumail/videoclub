"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./navbar.module.css";
import ytIconStyle from "@/components/styles/yt-icon.module.css";
import { Candal } from "next/font/google";
import { usePathname } from "next/navigation";
import SearchBar from "@/components/SearchBar";

const candal = Candal({ weight: "400", subsets: ["latin"] });

type LinkDescriptor = {
  href: string;
  content: ReactNode;
  matchPrefixes?: string[];
};

const normalizePath = (value: string) => value.replace(/\/$/, "");

const isActive = (pathname: string | null, { href, matchPrefixes }: LinkDescriptor) => {
  if (!pathname) {
    return false;
  }
  const sanitizedPath = normalizePath(pathname);
  const prefixes = (matchPrefixes?.length ? matchPrefixes : [href]).map(normalizePath);

  return prefixes.some((prefix) => sanitizedPath === prefix || sanitizedPath.startsWith(`${prefix}/`));
};

export default function Navbar() {
  const pathname = usePathname();
  const links: LinkDescriptor[] = [
    {
      href: "/film/meilleurs",
      content: <span>Top films</span>,
      matchPrefixes: ["/film"],
    },
    {
      href: "/serie/meilleures",
      content: <span>Top séries</span>,
      matchPrefixes: ["/serie"],
    },
    {
      href: "/video",
      content: (
        <div className={`${styles.videoLink}`}>
          <span>Vidéos</span> <div className={ytIconStyle.ytIcon} />
        </div>
      ),
    },
  ];
  return (
    <nav className={`${styles.nav} ${candal.className}`}>
      <ul className={styles.list}>
        {links.map((link, key) => (
          <li key={key} className={styles.item}>
            <Link
              href={link.href}
              className={`${styles.link} ${
                isActive(pathname, link) ? styles.currentLink : ""
              }`}
            >
              {link.content}
            </Link>
          </li>
        ))}
        <li className={`${styles.item} ${styles.searchItem}`}>
          <div className={styles.searchBarWrapper}>
            <SearchBar />
          </div>
        </li>
      </ul>
    </nav>
  );
}
