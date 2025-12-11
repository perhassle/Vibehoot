import { redis } from './redis';
import { prisma } from './prisma';

interface Player {
    id: string;
    nickname: string;
    score: number;
}

interface Answer {
    playerId: string;
    optionIndex: number;
    responseTimeMs: number;
}

interface GameState {
    sessionId: string;
    quizId: string;
    hostId: string;
    status: 'WAITING' | 'ACTIVE' | 'SHOWING_QUESTION' | 'SHOWING_RESULTS' | 'ENDED';
    currentQuestionIndex: number;
    players: Record<string, Player>;
    answers: Record<string, Answer>; // answers for current question
    questionStartTime: number | null;
    startTime: number | null;
}

export interface Question {
    id: string;
    text: string;
    options: string[];
    correctOptionIndex: number;
    timeLimit: number;
    order: number;
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
            answers: {},
            questionStartTime: null,
            startTime: null
        };

        await redis.set(`session:${joinCode}`, JSON.stringify(initialState));
        return joinCode;
    }

    static async joinSession(joinCode: string, nickname: string, playerId: string) {
        const stateRaw = await redis.get(`session:${joinCode}`);
        if (!stateRaw) throw new Error("Session not found");

        const state: GameState = JSON.parse(stateRaw as string);
        if (state.status !== 'WAITING') throw new Error("Game already started");

        state.players[playerId] = {
            id: playerId,
            nickname,
            score: 0
        };

        await redis.set(`session:${joinCode}`, JSON.stringify(state));
        return state;
    }

    static async getSession(joinCode: string): Promise<GameState | null> {
        const stateRaw = await redis.get(`session:${joinCode}`);
        if (!stateRaw) return null;
        return JSON.parse(stateRaw as string) as GameState;
    }

    static async getQuizQuestions(quizId: string): Promise<Question[]> {
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                }
            }
        });
        if (!quiz) return [];
        return quiz.questions.map(q => ({
            id: q.id,
            text: q.text,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            timeLimit: q.timeLimit,
            order: q.order
        }));
    }

    static async startGame(joinCode: string): Promise<GameState | null> {
        const state = await this.getSession(joinCode);
        if (!state) return null;

        state.status = 'ACTIVE';
        state.startTime = Date.now();
        state.currentQuestionIndex = -1;

        await redis.set(`session:${joinCode}`, JSON.stringify(state));

        // Update DB
        await prisma.session.update({
            where: { joinCode },
            data: { status: 'ACTIVE', startedAt: new Date() }
        });

        return state;
    }

    static async nextQuestion(joinCode: string): Promise<{ state: GameState; question: Question | null; totalQuestions: number }> {
        const state = await this.getSession(joinCode);
        if (!state) throw new Error("Session not found");

        const questions = await this.getQuizQuestions(state.quizId);

        state.currentQuestionIndex++;
        state.answers = {}; // Clear answers for new question
        state.questionStartTime = Date.now();
        state.status = 'SHOWING_QUESTION';

        const question = questions[state.currentQuestionIndex] || null;

        if (!question) {
            state.status = 'ENDED';
            await prisma.session.update({
                where: { joinCode },
                data: { status: 'ENDED', endedAt: new Date() }
            });
        }

        await redis.set(`session:${joinCode}`, JSON.stringify(state));

        return { state, question, totalQuestions: questions.length };
    }

    static async submitAnswer(joinCode: string, playerId: string, optionIndex: number): Promise<{ correct: boolean; score: number }> {
        const state = await this.getSession(joinCode);
        if (!state) throw new Error("Session not found");
        if (state.status !== 'SHOWING_QUESTION') throw new Error("Not accepting answers");
        if (state.answers[playerId]) throw new Error("Already answered");

        const questions = await this.getQuizQuestions(state.quizId);
        const question = questions[state.currentQuestionIndex];
        if (!question) throw new Error("No current question");

        const responseTimeMs = Date.now() - (state.questionStartTime || Date.now());
        const correct = optionIndex === question.correctOptionIndex;

        // Calculate score: base 1000 points, bonus for speed (max 500 extra)
        let points = 0;
        if (correct) {
            const timeBonus = Math.max(0, 1 - (responseTimeMs / (question.timeLimit * 1000)));
            points = Math.round(1000 + (timeBonus * 500));
        }

        state.answers[playerId] = {
            playerId,
            optionIndex,
            responseTimeMs
        };

        if (state.players[playerId]) {
            state.players[playerId].score += points;
        }

        await redis.set(`session:${joinCode}`, JSON.stringify(state));

        return { correct, score: points };
    }

    static async showResults(joinCode: string): Promise<{
        state: GameState;
        correctOptionIndex: number;
        answerDistribution: number[];
        correctCount: number;
    }> {
        const state = await this.getSession(joinCode);
        if (!state) throw new Error("Session not found");

        const questions = await this.getQuizQuestions(state.quizId);
        const question = questions[state.currentQuestionIndex];
        if (!question) throw new Error("No current question");

        state.status = 'SHOWING_RESULTS';
        await redis.set(`session:${joinCode}`, JSON.stringify(state));

        // Calculate answer distribution
        const distribution = [0, 0, 0, 0];
        let correctCount = 0;

        Object.values(state.answers).forEach(answer => {
            if (answer.optionIndex >= 0 && answer.optionIndex < 4) {
                distribution[answer.optionIndex]++;
            }
            if (answer.optionIndex === question.correctOptionIndex) {
                correctCount++;
            }
        });

        return {
            state,
            correctOptionIndex: question.correctOptionIndex,
            answerDistribution: distribution,
            correctCount
        };
    }

    static async getLeaderboard(joinCode: string): Promise<Player[]> {
        const state = await this.getSession(joinCode);
        if (!state) return [];

        return Object.values(state.players)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    static async endGame(joinCode: string): Promise<void> {
        const state = await this.getSession(joinCode);
        if (!state) return;

        state.status = 'ENDED';
        await redis.set(`session:${joinCode}`, JSON.stringify(state));

        await prisma.session.update({
            where: { joinCode },
            data: { status: 'ENDED', endedAt: new Date() }
        });
    }
}
