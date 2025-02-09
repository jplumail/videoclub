import { JSX } from "react";
import styles from "./Gallery.module.css";

type Props = {
    children: React.ReactElement<JSX.IntrinsicElements['li']> | React.ReactElement<JSX.IntrinsicElements['li']>[];
};

export default function Gallery({ children }: Props) {
    return <ul className={styles.list}>{children}</ul>;
}