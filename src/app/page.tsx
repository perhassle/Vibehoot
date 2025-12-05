import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
    return (
        <main className={styles.main}>
            <div className={styles.hero}>
                <h1 className={styles.title}>VIBEHOOT</h1>
                <p className={styles.subtitle}>Real-time quizzes. Zero friction. Maximum Vibe.</p>

                <div className={styles.actions}>
                    <Link href="/host/dashboard" className={styles.primaryBtn}>
                        Host a Game
                    </Link>
                    <Link href="/play" className={styles.secondaryBtn}>
                        Join Game
                    </Link>
                </div>
            </div>
        </main>
    );
}
