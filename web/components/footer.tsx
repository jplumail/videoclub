import Image from "next/image";
import styles from "./footer.module.css";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className={styles.footer}>
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
    </footer>
  );
}
