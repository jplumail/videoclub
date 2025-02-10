import styles from "./footer.module.css";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <span>
          Les posters des films proviennent de{" "}
          <Link
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            TMDB
          </Link>
          .
        </span>
        <span className={styles.copyright}>© 2025 Jean Plumail </span>
        <span>
          <Link
            href="https://github.com/jplumail/videoclub/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/github-mark.svg"
              alt="GitHub"
              width={98}
              height={96}
              className={styles.githubIcon}
            />
          </Link>
        </span>
      </div>
    </footer>
  );
}
