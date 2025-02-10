"use client";

import Link from "next/link";
import styles from "./navbar.module.css";
import ytIconStyle from "@/components/styles/yt-icon.module.css";
import utilsStyles from "@/components/styles/utils.module.css";
import { Candal } from "next/font/google";
import { usePathname } from "next/navigation";

const candal = Candal({ weight: "400", subsets: ["latin"] });

export default function Navbar() {
  const pathname = usePathname();
  const links = [
    { href: "/film/meilleurs", content: <span>Top films</span> },
    { href: "/serie/meilleures", content: <span>Top séries</span> },
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
        {links.map(({ href, content }, key) => (
          <Link
            key={key}
            href={href}
            className={`${styles.link} ${
              pathname?.replace(/\/$/, "").startsWith(href.replace(/\/$/, ""))
                ? styles.currentLink
                : ""
            } ${utilsStyles.textShadow}`}
          >
            {content}
          </Link>
        ))}
      </ul>
    </nav>
  );
}
