"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from '../../create/page.module.css';

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

export default function EditQuiz() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

    const [title, setTitle] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [showImportModal, setShowImportModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [importError, setImportError] = useState('');
    const [jsonValid, setJsonValid] = useState<boolean | null>(null);
    const [questionCount, setQuestionCount] = useState(0);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    useEffect(() => {
        const loadQuiz = async () => {
            try {
                const res = await fetch(`/api/quizzes/${quizId}`);
                if (res.ok) {
                    const quiz = await res.json();
                    setTitle(quiz.title);
                    setQuestions(quiz.questions.map((q: any) => ({
                        text: q.text,
                        options: q.options,
                        correctOptionIndex: q.correctOptionIndex,
                        timeLimit: q.timeLimit,
                        type: q.type
                    })));
                } else {
                    alert('Quiz not found');
                    router.push('/host/dashboard');
                }
            } catch (e) {
                alert('Error loading quiz');
                router.push('/host/dashboard');
            } finally {
                setInitialLoading(false);
            }
        };
        loadQuiz();
    }, [quizId, router]);

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
                q.options.length === 4 &&
                typeof q.correct_index === 'number'
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
        try {
            const parsed: JsonQuestion[] = JSON.parse(jsonInput);
            if (!Array.isArray(parsed)) {
                throw new Error('JSON must be an array of questions');
            }
            if (parsed.length === 0) {
                throw new Error('JSON must contain at least one question');
            }
            const importedQuestions: Question[] = parsed.map((q, index) => {
                if (!q.question || !Array.isArray(q.options) || typeof q.correct_index !== 'number') {
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
            // Replace all existing questions
            setQuestions(importedQuestions);
            setShowImportModal(false);
            setJsonInput('');
            setJsonValid(null);
            setQuestionCount(0);
        } catch (e: any) {
            setImportError(e.message || 'Invalid JSON format');
        }
    };

    const addQuestion = () => {
        setQuestions([...questions, { text: '', options: ['', '', '', ''], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' }]);
    };

    const removeQuestion = (index: number) => {
        if (questions.length > 1) {
            setQuestions(questions.filter((_, i) => i !== index));
        }
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
            const res = await fetch(`/api/quizzes/${quizId}`, {
                method: 'PUT',
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

    const deleteQuiz = async () => {
        try {
            const res = await fetch(`/api/quizzes/${quizId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                router.push('/host/dashboard');
            } else {
                alert('Failed to delete');
            }
        } catch (e) {
            alert('Error deleting');
        }
    };

    if (initialLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>Loading quiz...</div>
            </div>
        );
    }

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
                    <button onClick={() => setShowDeleteConfirm(true)} className={styles.deleteBtn}>
                        Delete
                    </button>
                    <button onClick={() => setShowImportModal(true)} className={styles.importBtn}>
                        Import JSON
                    </button>
                    <button onClick={saveQuiz} className={styles.saveBtn} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            {showDeleteConfirm && (
                <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2>Delete Quiz?</h2>
                        <p className={styles.deleteWarning}>
                            This will permanently delete "{title}" and all its questions. This action cannot be undone.
                        </p>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowDeleteConfirm(false)} className={styles.cancelBtn}>
                                Cancel
                            </button>
                            <button onClick={deleteQuiz} className={styles.deleteConfirmBtn}>
                                Delete Quiz
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className={styles.modalOverlay} onClick={() => setShowImportModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h2>Import Questions from JSON</h2>
                        <p className={styles.importWarning}>
                            This will replace all existing questions!
                        </p>
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
                            <button onClick={importFromJson} className={styles.confirmBtn} disabled={!jsonValid}>
                                Replace All Questions
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
                            {questions.length > 1 && (
                                <button
                                    onClick={() => removeQuestion(qIndex)}
                                    className={styles.removeQuestionBtn}
                                    title="Remove question"
                                >
                                    ✕
                                </button>
                            )}
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
