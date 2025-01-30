"use client";

import Link from "next/link";
import styles from "./navbar.module.css";
import { Candal } from "next/font/google";
import { usePathname } from "next/navigation";

const candal = Candal({ weight: "400", subsets: ["latin"] });

export default function Navbar() {
  const pathname = usePathname();
  const links = [
    { href: "/film/meilleurs", content: "Films" },
    { href: "/serie/meilleures", content: "Séries" },
    { href: "/video", content: "Vidéos" },
  ];
  return (
    <nav className={`${styles.nav} ${candal.className}`}>
      <ul className={styles.list}>
        {links.map(({ href, content }, key) => (
          <Link
            key={key}
            href={href}
            className={`${styles.link} ${
              pathname?.replace(/\/$/, "") === href.replace(/\/$/, "")
                ? styles.currentLink
                : ""
            }`}
          >
            {content}
          </Link>
        ))}
      </ul>
    </nav>
  );
}
