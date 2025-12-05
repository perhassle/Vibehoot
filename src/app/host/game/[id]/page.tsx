"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import styles from './page.module.css';

interface Player {
    playerId: string;
    nickname: string;
    score: number;
}

export default function GameHost() {
    const params = useParams();
    const [joinCode, setJoinCode] = useState<string>('');
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameState, setGameState] = useState<'LOBBY' | 'GAME' | 'LEADERBOARD' | 'ENDED'>('LOBBY');
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        const socket = io();
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to server');
            // Create game session
            socket.emit('create_game', { quizId: params.id, hostId: 'host-123' }, (response: any) => {
                if (response.success) {
                    setJoinCode(response.joinCode);
                }
            });
        });

        socket.on('player_joined', (player: Player) => {
            setPlayers(prev => [...prev, player]);
        });

        socket.on('game_started', () => {
            setGameState('GAME');
        });

        return () => {
            socket.disconnect();
        };
    }, [params.id]);

    const startGame = () => {
        if (socketRef.current && joinCode) {
            socketRef.current.emit('start_game', { joinCode }, (res: any) => {
                if (res.success) setGameState('GAME');
            });
        }
    };

    return (
        <div className={styles.container}>
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
                        <button className={styles.startBtn} onClick={startGame}>
                            Start Game
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'GAME' && (
                <div className={styles.gameView}>
                    <h1>Game Started! (Question View Placeholder)</h1>
                </div>
            )}
        </div>
    );
}
