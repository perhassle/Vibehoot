"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

interface Question {
    text: string;
    options: string[];
    correctOptionIndex: number;
    timeLimit: number;
    type: 'MCQ';
}

export default function CreateQuiz() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<Question[]>([
        { text: '', options: ['', '', '', ''], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' }
    ]);
    const [loading, setLoading] = useState(false);

    const addQuestion = () => {
        setQuestions([...questions, { text: '', options: ['', '', '', ''], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' }]);
    };

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        setQuestions(newQuestions);
    };

    const updateOption = (qIndex: number, oIndex: number, value: string) => {
        const newQuestions = [...questions];
        newQuestions[qIndex].options[oIndex] = value;
        setQuestions(newQuestions);
    };

    const saveQuiz = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, questions })
            });
            if (res.ok) {
                router.push('/host/dashboard');
            } else {
                alert('Failed to save');
            }
        } catch (e) {
            alert('Error saving');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <input
                    className={styles.titleInput}
                    placeholder="Enter Quiz Title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <button onClick={saveQuiz} className={styles.saveBtn} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Quiz'}
                </button>
            </header>

            <div className={styles.questionsList}>
                {questions.map((q, qIndex) => (
                    <div key={qIndex} className={styles.questionCard}>
                        <div className={styles.cardHeader}>
                            <span>Question {qIndex + 1}</span>
                            <input
                                type="number"
                                value={q.timeLimit}
                                onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                                className={styles.timeInput}
                            />
                            <span className={styles.secondsLabel}>sec</span>
                        </div>

                        <input
                            className={styles.questionInput}
                            placeholder="Question text?"
                            value={q.text}
                            onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                        />

                        <div className={styles.optionsGrid}>
                            {q.options.map((opt, oIndex) => (
                                <div
                                    key={oIndex}
                                    className={`${styles.optionRow} ${q.correctOptionIndex === oIndex ? styles.correct : ''}`}
                                    onClick={() => updateQuestion(qIndex, 'correctOptionIndex', oIndex)}
                                >
                                    <div className={styles.optionMarker}></div>
                                    <input
                                        value={opt}
                                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                        placeholder={`Option ${oIndex + 1}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <button onClick={addQuestion} className={styles.addBtn}>
                    + Add Question
                </button>
            </div>
        </div>
    );
}
