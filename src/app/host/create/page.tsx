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

interface JsonQuestion {
    question: string;
    options: string[];
    correct_index: number;
}

export default function CreateQuiz() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<Question[]>([
        { text: '', options: ['', '', '', ''], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' }
    ]);
    const [loading, setLoading] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [importTitle, setImportTitle] = useState('');
    const [importError, setImportError] = useState('');
    const [jsonValid, setJsonValid] = useState<boolean | null>(null);
    const [questionCount, setQuestionCount] = useState(0);

    const exampleJson = `[
  {
    "question": "What is the capital of France?",
    "options": ["London", "Paris", "Berlin", "Madrid"],
    "correct_index": 1
  },
  {
    "question": "Which planet is closest to the sun?",
    "options": ["Venus", "Earth", "Mercury", "Mars"],
    "correct_index": 2
  }
]`;

    const validateJson = (input: string) => {
        if (!input.trim()) {
            setJsonValid(null);
            setQuestionCount(0);
            return;
        }
        try {
            const parsed = JSON.parse(input);
            if (!Array.isArray(parsed)) {
                setJsonValid(false);
                setQuestionCount(0);
                return;
            }
            const valid = parsed.every((q: any) =>
                q.question &&
                Array.isArray(q.options) &&
                q.options.length >= 2 &&
                typeof q.correct_index === 'number' &&
                Number.isInteger(q.correct_index) &&
                q.correct_index >= 0 &&
                q.correct_index < q.options.length
            );
            setJsonValid(valid && parsed.length > 0);
            setQuestionCount(valid ? parsed.length : 0);
        } catch {
            setJsonValid(false);
            setQuestionCount(0);
        }
    };

    const handleJsonChange = (value: string) => {
        setJsonInput(value);
        validateJson(value);
        setImportError('');
    };

    const importFromJson = () => {
        setImportError('');
        if (!importTitle.trim()) {
            setImportError('Quiz title is required');
            return;
        }
        try {
            const parsed: JsonQuestion[] = JSON.parse(jsonInput);
            if (!Array.isArray(parsed)) {
                throw new Error('JSON must be an array of questions');
            }
            if (parsed.length === 0) {
                throw new Error('JSON must contain at least one question');
            }
            const importedQuestions: Question[] = parsed.map((q, index) => {
                if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || 
                    typeof q.correct_index !== 'number' || !Number.isInteger(q.correct_index) ||
                    q.correct_index < 0 || q.correct_index >= q.options.length) {
                    throw new Error(`Invalid question format at index ${index}`);
                }
                return {
                    text: q.question,
                    options: q.options.slice(0, 4),
                    correctOptionIndex: q.correct_index,
                    timeLimit: 20,
                    type: 'MCQ' as const
                };
            });
            setTitle(importTitle.trim());
            setQuestions(importedQuestions);
            setShowImportModal(false);
            setJsonInput('');
            setImportTitle('');
        } catch (e: any) {
            setImportError(e.message || 'Invalid JSON format');
        }
    };

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
                <div className={styles.headerActions}>
                    <button onClick={() => setShowImportModal(true)} className={styles.importBtn}>
                        Import JSON
                    </button>
                    <button onClick={saveQuiz} className={styles.saveBtn} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Quiz'}
                    </button>
                </div>
            </header>

            {showImportModal && (
                <div className={styles.modalOverlay} onClick={() => setShowImportModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2>Import Questions from JSON</h2>
                        <input
                            className={styles.importTitleInput}
                            placeholder="Quiz Title (required)"
                            value={importTitle}
                            onChange={(e) => setImportTitle(e.target.value)}
                        />
                        <div className={styles.jsonStatus}>
                            {jsonValid === true && (
                                <span className={styles.validStatus}>✓ Valid JSON ({questionCount} questions)</span>
                            )}
                            {jsonValid === false && (
                                <span className={styles.invalidStatus}>✗ Invalid JSON format</span>
                            )}
                        </div>
                        <textarea
                            className={`${styles.jsonTextarea} ${jsonValid === true ? styles.validBorder : ''} ${jsonValid === false ? styles.invalidBorder : ''}`}
                            placeholder={exampleJson}
                            value={jsonInput}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            rows={14}
                        />
                        {importError && <p className={styles.errorText}>{importError}</p>}
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowImportModal(false)} className={styles.cancelBtn}>
                                Cancel
                            </button>
                            <button onClick={importFromJson} className={styles.confirmBtn}>
                                Import Questions
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
