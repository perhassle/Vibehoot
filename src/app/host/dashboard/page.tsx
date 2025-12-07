"use client";

import Link from "next/link";
import styles from "./page.module.css";
import { useEffect, useState } from "react";

export default function HostDashboard() {
    const [quizzes, setQuizzes] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/quizzes')
            .then(res => res.json())
            .then(data => setQuizzes(data));
    }, []);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.logo}>VIBEHOOT <span>HOST</span></h1>
                <div className={styles.userControls}>
                    <span>My Quizzes</span>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.toolbar}>
                    <h2>My Library</h2>
                    <Link href="/host/create" className={styles.createBtn}>
                        + Create New Quiz
                    </Link>
                </div>

                <div className={styles.grid}>
                    {quizzes.map((quiz) => (
                        <div key={quiz.id} className={styles.quizCard}>
                            <h3>{quiz.title}</h3>
                            <p>{quiz._count.questions} questions</p>
                            <div className={styles.cardActions}>
                                <Link href={`/host/edit/${quiz.id}`} className={styles.editBtn}>
                                    Edit
                                </Link>
                                <Link href={`/host/game/${quiz.id}`} className={styles.playBtn}>
                                    Host Game
                                </Link>
                            </div>
                        </div>
                    ))}
                    {quizzes.length === 0 && (
                        <div className={styles.emptyState}>
                            <p>No vibes found yet.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
