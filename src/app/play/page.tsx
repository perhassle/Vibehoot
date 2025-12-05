"use client";

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './page.module.css';

export default function PlayerApp() {
    const [joinCode, setJoinCode] = useState('');
    const [nickname, setNickname] = useState('');
    const [status, setStatus] = useState<'JOIN' | 'WAITING' | 'GAME' | 'RESULT'>('JOIN');
    const [playerId, setPlayerId] = useState('');
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
            setStatus('GAME');
        });

        socket.on('disconnect', () => {
            alert('Disconnected');
            setStatus('JOIN');
        });
    };

    return (
        <div className={styles.container}>
            {status === 'JOIN' && (
                <div className={styles.card}>
                    <h1 className={styles.logo}>VIBEHOOT</h1>
                    <input
                        className={styles.input}
                        placeholder="Join Code"
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value)}
                    />
                    <input
                        className={styles.input}
                        placeholder="Nickname"
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                    />
                    <button className={styles.joinBtn} onClick={joinGame}>
                        Join Game
                    </button>
                </div>
            )}

            {status === 'WAITING' && (
                <div className={styles.center}>
                    <h2 className={styles.blink}>You're in!</h2>
                    <p>See your name on screen?</p>
                </div>
            )}

            {status === 'GAME' && (
                <div className={styles.center}>
                    <h2>Get Ready!</h2>
                    <p>Look at the host screen...</p>
                    {/* Placeholder for Answer Buttons */}
                    <div className={styles.answersGrid}>
                        <button className={styles.answerBtn} style={{ background: '#E21B3C' }}></button>
                        <button className={styles.answerBtn} style={{ background: '#1368CE' }}></button>
                        <button className={styles.answerBtn} style={{ background: '#D89E00' }}></button>
                        <button className={styles.answerBtn} style={{ background: '#26890C' }}></button>
                    </div>
                </div>
            )}
        </div>
    );
}
