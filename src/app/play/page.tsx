"use client";

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './page.module.css';

const OPTION_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];

interface Question {
    text: string;
    options: string[];
    timeLimit: number;
}

interface Player {
    id: string;
    nickname: string;
    score: number;
}

export default function PlayerApp() {
    const [joinCode, setJoinCode] = useState('');
    const [nickname, setNickname] = useState('');
    const [status, setStatus] = useState<'JOIN' | 'WAITING' | 'QUESTION' | 'ANSWERED' | 'RESULT' | 'LEADERBOARD' | 'ENDED'>('JOIN');
    const [playerId, setPlayerId] = useState('');
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [lastResult, setLastResult] = useState<{ correct: boolean; score: number } | null>(null);
    const [totalScore, setTotalScore] = useState(0);
    const [myRank, setMyRank] = useState(0);
    const socketRef = useRef<Socket | null>(null);

    const joinGame = () => {
        if (!joinCode || !nickname) return;

        const socket = io();
        socketRef.current = socket;
        const pid = Math.random().toString(36).substring(7);
        setPlayerId(pid);

        socket.on('connect', () => {
            socket.emit('join_game', { joinCode, nickname, playerId: pid }, (res: any) => {
                if (res.success) {
                    setStatus('WAITING');
                } else {
                    alert('Failed to join: ' + res.error);
                }
            });
        });

        socket.on('game_started', () => {
            // Game is starting, wait for first question
        });

        socket.on('question_start', (data) => {
            setCurrentQuestion({
                text: data.text,
                options: data.options,
                timeLimit: data.timeLimit
            });
            setQuestionIndex(data.questionIndex);
            setTotalQuestions(data.totalQuestions);
            setSelectedAnswer(null);
            setLastResult(null);
            setStatus('QUESTION');
        });

        socket.on('question_results', (data) => {
            // Show if our answer was correct
            if (selectedAnswer !== null) {
                const wasCorrect = selectedAnswer === data.correctOptionIndex;
                setLastResult({
                    correct: wasCorrect,
                    score: lastResult?.score || 0
                });
            }
            setStatus('RESULT');
        });

        socket.on('leaderboard_update', (data) => {
            const rank = data.leaderboard.findIndex((p: Player) => p.id === pid) + 1;
            setMyRank(rank);
            const myPlayer = data.leaderboard.find((p: Player) => p.id === pid);
            if (myPlayer) {
                setTotalScore(myPlayer.score);
            }
            setStatus('LEADERBOARD');
        });

        socket.on('game_ended', (data) => {
            const rank = data.leaderboard.findIndex((p: Player) => p.id === pid) + 1;
            setMyRank(rank);
            const myPlayer = data.leaderboard.find((p: Player) => p.id === pid);
            if (myPlayer) {
                setTotalScore(myPlayer.score);
            }
            setStatus('ENDED');
        });

        socket.on('disconnect', () => {
            // Could show reconnect UI
        });
    };

    const submitAnswer = (optionIndex: number) => {
        if (socketRef.current && selectedAnswer === null) {
            setSelectedAnswer(optionIndex);
            socketRef.current.emit('submit_answer', {
                joinCode,
                playerId,
                optionIndex
            }, (res: any) => {
                if (res.success) {
                    setLastResult({ correct: res.correct, score: res.score });
                    setTotalScore(prev => prev + res.score);
                    setStatus('ANSWERED');
                }
            });
        }
    };

    return (
        <div className={styles.container}>
            {/* JOIN SCREEN */}
            {status === 'JOIN' && (
                <div className={styles.card}>
                    <h1 className={styles.logo}>VIBEHOOT</h1>
                    <input
                        className={styles.input}
                        placeholder="Game PIN"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value)}
                        maxLength={6}
                    />
                    <input
                        className={styles.input}
                        placeholder="Nickname"
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        maxLength={20}
                    />
                    <button className={styles.joinBtn} onClick={joinGame}>
                        Join Game
                    </button>
                </div>
            )}

            {/* WAITING SCREEN */}
            {status === 'WAITING' && (
                <div className={styles.center}>
                    <h2 className={styles.blink}>You're in!</h2>
                    <p className={styles.nickname}>{nickname}</p>
                    <p className={styles.waitingText}>Waiting for host to start...</p>
                </div>
            )}

            {/* QUESTION SCREEN - Show answer buttons */}
            {status === 'QUESTION' && currentQuestion && (
                <div className={styles.questionScreen}>
                    <div className={styles.questionInfo}>
                        <span>Question {questionIndex + 1} of {totalQuestions}</span>
                    </div>
                    <div className={styles.answersGrid}>
                        {currentQuestion.options.map((_, index) => (
                            <button
                                key={index}
                                className={styles.answerBtn}
                                style={{ backgroundColor: OPTION_COLORS[index] }}
                                onClick={() => submitAnswer(index)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ANSWERED SCREEN */}
            {status === 'ANSWERED' && lastResult && (
                <div className={styles.center}>
                    <div className={`${styles.resultIcon} ${lastResult.correct ? styles.correct : styles.wrong}`}>
                        {lastResult.correct ? '✓' : '✗'}
                    </div>
                    <h2>{lastResult.correct ? 'Correct!' : 'Wrong!'}</h2>
                    {lastResult.correct && (
                        <p className={styles.scoreGain}>+{lastResult.score} points</p>
                    )}
                    <p className={styles.totalScore}>Total: {totalScore}</p>
                </div>
            )}

            {/* RESULT SCREEN (after time's up) */}
            {status === 'RESULT' && (
                <div className={styles.center}>
                    {selectedAnswer === null ? (
                        <>
                            <div className={`${styles.resultIcon} ${styles.wrong}`}>⏱</div>
                            <h2>Time's up!</h2>
                            <p>You didn't answer in time</p>
                        </>
                    ) : (
                        <>
                            <div className={`${styles.resultIcon} ${lastResult?.correct ? styles.correct : styles.wrong}`}>
                                {lastResult?.correct ? '✓' : '✗'}
                            </div>
                            <h2>{lastResult?.correct ? 'Correct!' : 'Wrong!'}</h2>
                        </>
                    )}
                    <p className={styles.waitingText}>Waiting for next question...</p>
                </div>
            )}

            {/* LEADERBOARD SCREEN */}
            {status === 'LEADERBOARD' && (
                <div className={styles.leaderboardScreen}>
                    <h2>Leaderboard</h2>
                    {myRank > 0 && (
                        <div className={styles.myRank}>
                            You're #{myRank} with {totalScore} points
                        </div>
                    )}
                    <p className={styles.waitingText}>Get ready for the next question...</p>
                </div>
            )}

            {/* GAME ENDED SCREEN */}
            {status === 'ENDED' && (
                <div className={styles.endedScreen}>
                    <h1 className={styles.gameOver}>Game Over!</h1>
                    <div className={styles.finalRank}>
                        {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}
                    </div>
                    <p className={styles.finalScore}>{totalScore} points</p>
                    <p className={styles.finalNickname}>{nickname}</p>
                </div>
            )}
        </div>
    );
}
