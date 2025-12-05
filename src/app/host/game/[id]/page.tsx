"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import styles from './page.module.css';

interface Player {
    playerId: string;
    nickname: string;
    score: number;
}

interface Question {
    text: string;
    options: string[];
    timeLimit: number;
}

const OPTION_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'];

export default function GameHost() {
    const params = useParams();
    const [joinCode, setJoinCode] = useState<string>('');
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameState, setGameState] = useState<'LOBBY' | 'QUESTION' | 'RESULTS' | 'LEADERBOARD' | 'ENDED'>('LOBBY');
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answerCount, setAnswerCount] = useState(0);
    const [answerDistribution, setAnswerDistribution] = useState<number[]>([0, 0, 0, 0]);
    const [correctOptionIndex, setCorrectOptionIndex] = useState(-1);
    const [leaderboard, setLeaderboard] = useState<Player[]>([]);
    const socketRef = useRef<Socket | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const nextQuestion = useCallback(() => {
        if (socketRef.current && joinCode) {
            socketRef.current.emit('next_question', { joinCode }, (res: any) => {
                if (res.success) {
                    if (res.ended) {
                        setLeaderboard(res.leaderboard);
                        setGameState('ENDED');
                    } else {
                        setCurrentQuestion({
                            text: res.question.text,
                            options: res.question.options,
                            timeLimit: res.question.timeLimit
                        });
                        setQuestionIndex(res.questionIndex);
                        setTotalQuestions(res.totalQuestions);
                        setTimeLeft(res.question.timeLimit);
                        setAnswerCount(0);
                        setGameState('QUESTION');
                    }
                }
            });
        }
    }, [joinCode]);

    const showResults = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (socketRef.current && joinCode) {
            socketRef.current.emit('show_results', { joinCode }, (res: any) => {
                if (res.success) {
                    setAnswerDistribution(res.answerDistribution);
                    setCorrectOptionIndex(res.correctOptionIndex);
                    setGameState('RESULTS');
                }
            });
        }
    }, [joinCode]);

    const showLeaderboard = useCallback(() => {
        if (socketRef.current && joinCode) {
            socketRef.current.emit('get_leaderboard', { joinCode }, (res: any) => {
                if (res.success) {
                    setLeaderboard(res.leaderboard);
                    setGameState('LEADERBOARD');
                }
            });
        }
    }, [joinCode]);

    useEffect(() => {
        const socket = io();
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to server');
            socket.emit('create_game', { quizId: params.id, hostId: 'host-123' }, (response: any) => {
                if (response.success) {
                    setJoinCode(response.joinCode);
                }
            });
        });

        socket.on('player_joined', (player: Player) => {
            setPlayers(prev => {
                if (prev.find(p => p.playerId === player.playerId)) return prev;
                return [...prev, player];
            });
        });

        socket.on('answer_count_update', ({ answerCount: count }) => {
            setAnswerCount(count);
        });

        socket.on('player_disconnected', ({ playerId }) => {
            setPlayers(prev => prev.filter(p => p.playerId !== playerId));
        });

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            socket.disconnect();
        };
    }, [params.id]);

    // Timer effect
    useEffect(() => {
        if (gameState === 'QUESTION' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        showResults();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, timeLeft, showResults]);

    const startGame = () => {
        if (socketRef.current && joinCode) {
            socketRef.current.emit('start_game', { joinCode }, (res: any) => {
                if (res.success) {
                    nextQuestion();
                }
            });
        }
    };

    return (
        <div className={styles.container}>
            {/* LOBBY STATE */}
            {gameState === 'LOBBY' && (
                <div className={styles.lobby}>
                    <header className={styles.lobbyHeader}>
                        <div className={styles.joinInfo}>
                            <span className={styles.joinLabel}>JOIN AT VIBEHOOT.COM WITH CODE</span>
                            <span className={styles.joinCode}>{joinCode || '...'}</span>
                        </div>
                    </header>

                    <div className={styles.playersGrid}>
                        {players.map(p => (
                            <div key={p.playerId} className={styles.playerCard}>
                                {p.nickname}
                            </div>
                        ))}
                    </div>

                    <div className={styles.footer}>
                        <div className={styles.playerCount}>
                            {players.length} Players
                        </div>
                        <button className={styles.startBtn} onClick={startGame} disabled={players.length === 0}>
                            Start Game
                        </button>
                    </div>
                </div>
            )}

            {/* QUESTION STATE */}
            {gameState === 'QUESTION' && currentQuestion && (
                <div className={styles.questionView}>
                    <div className={styles.questionHeader}>
                        <span className={styles.questionNumber}>Question {questionIndex + 1} of {totalQuestions}</span>
                        <div className={styles.timer}>{timeLeft}</div>
                        <span className={styles.answerCounter}>{answerCount} / {players.length} answered</span>
                    </div>

                    <div className={styles.questionContent}>
                        <h1 className={styles.questionText}>{currentQuestion.text}</h1>
                    </div>

                    <div className={styles.optionsDisplay}>
                        {currentQuestion.options.map((option, index) => (
                            <div
                                key={index}
                                className={styles.optionCard}
                                style={{ backgroundColor: OPTION_COLORS[index] }}
                            >
                                <span className={styles.optionText}>{option}</span>
                            </div>
                        ))}
                    </div>

                    <button className={styles.skipBtn} onClick={showResults}>
                        Skip Timer
                    </button>
                </div>
            )}

            {/* RESULTS STATE */}
            {gameState === 'RESULTS' && currentQuestion && (
                <div className={styles.resultsView}>
                    <h2 className={styles.resultsTitle}>Results</h2>
                    <p className={styles.questionRecap}>{currentQuestion.text}</p>

                    <div className={styles.resultsGrid}>
                        {currentQuestion.options.map((option, index) => (
                            <div
                                key={index}
                                className={`${styles.resultCard} ${index === correctOptionIndex ? styles.correctAnswer : ''}`}
                                style={{ backgroundColor: OPTION_COLORS[index] }}
                            >
                                <div className={styles.resultBar}>
                                    <div
                                        className={styles.resultFill}
                                        style={{
                                            height: `${players.length > 0 ? (answerDistribution[index] / players.length) * 100 : 0}%`
                                        }}
                                    />
                                </div>
                                <span className={styles.resultCount}>{answerDistribution[index]}</span>
                                <span className={styles.resultOption}>{option}</span>
                                {index === correctOptionIndex && <span className={styles.checkmark}>✓</span>}
                            </div>
                        ))}
                    </div>

                    <button className={styles.nextBtn} onClick={showLeaderboard}>
                        Show Leaderboard
                    </button>
                </div>
            )}

            {/* LEADERBOARD STATE */}
            {gameState === 'LEADERBOARD' && (
                <div className={styles.leaderboardView}>
                    <h2 className={styles.leaderboardTitle}>Leaderboard</h2>

                    <div className={styles.leaderboardList}>
                        {leaderboard.map((player, index) => (
                            <div key={player.playerId} className={styles.leaderboardRow}>
                                <span className={styles.rank}>#{index + 1}</span>
                                <span className={styles.playerName}>{player.nickname}</span>
                                <span className={styles.playerScore}>{player.score}</span>
                            </div>
                        ))}
                    </div>

                    <button className={styles.nextBtn} onClick={nextQuestion}>
                        Next Question
                    </button>
                </div>
            )}

            {/* ENDED STATE */}
            {gameState === 'ENDED' && (
                <div className={styles.endedView}>
                    <h1 className={styles.endedTitle}>Game Over!</h1>

                    <div className={styles.podium}>
                        {leaderboard.slice(0, 3).map((player, index) => (
                            <div key={player.playerId} className={`${styles.podiumPlace} ${styles[`place${index + 1}`]}`}>
                                <span className={styles.podiumRank}>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                                <span className={styles.podiumName}>{player.nickname}</span>
                                <span className={styles.podiumScore}>{player.score} pts</span>
                            </div>
                        ))}
                    </div>

                    <div className={styles.fullLeaderboard}>
                        {leaderboard.slice(3).map((player, index) => (
                            <div key={player.playerId} className={styles.leaderboardRow}>
                                <span className={styles.rank}>#{index + 4}</span>
                                <span className={styles.playerName}>{player.nickname}</span>
                                <span className={styles.playerScore}>{player.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
