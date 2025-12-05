import { redis } from './redis';
import { prisma } from './prisma';

interface Player {
    id: string;
    nickname: string;
    score: number;
}

interface GameState {
    sessionId: string;
    quizId: string;
    hostId: string;
    status: 'WAITING' | 'ACTIVE' | 'ENDED';
    currentQuestionIndex: number;
    players: Record<string, Player>;
    startTime: number | null;
}

export class GameEngine {

    static async createSession(quizId: string, hostId: string): Promise<string> {
        // Generate a 6-digit Join Code
        const joinCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Create DB record
        const session = await prisma.session.create({
            data: {
                joinCode,
                quizId,
                hostId,
                status: 'WAITING'
            }
        });

        // Initialize Redis State
        const initialState: GameState = {
            sessionId: session.id,
            quizId,
            hostId,
            status: 'WAITING',
            currentQuestionIndex: -1,
            players: {},
            startTime: null
        };

        await redis.set(`session:${joinCode}`, JSON.stringify(initialState));
        return joinCode;
    }

    static async joinSession(joinCode: string, nickname: string, playerId: string) {
        const stateRaw = await redis.get(`session:${joinCode}`);
        if (!stateRaw) throw new Error("Session not found");

        const state: GameState = JSON.parse(stateRaw);
        if (state.status !== 'WAITING') throw new Error("Game already started");

        state.players[playerId] = {
            id: playerId,
            nickname,
            score: 0
        };

        await redis.set(`session:${joinCode}`, JSON.stringify(state));
        return state;
    }

    static async getSession(joinCode: string) {
        const stateRaw = await redis.get(`session:${joinCode}`);
        if (!stateRaw) return null;
        return JSON.parse(stateRaw) as GameState;
    }
}
