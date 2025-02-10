import { Candal } from "next/font/google";
import styles from "./styles/logo.module.css";
import Link from "next/link";

const candal = Candal({ weight: "400", subsets: ["latin"] });

export default function Logo() {
  return (
    <Link href="/" className={`${styles.logo} ${candal.className}`}>
      <div className={`${styles.red} ${styles.gauche}`}>
        <span>VIDEO</span>
      </div>
      <div className={`${styles.red} ${styles.gauche}`}>
        <span>CLUB</span>
      </div>
      <div className={`${styles.black} ${styles.droite} ${styles.fullHeight}`}>
        <span>TOP</span>
      </div>
    </Link>
  );
}
