import { GameEngine } from '../game-engine';

// Mock Redis
const mockRedisData: Record<string, string> = {};
jest.mock('../redis', () => ({
  redis: {
    get: jest.fn((key: string) => Promise.resolve(mockRedisData[key] || null)),
    set: jest.fn((key: string, value: string) => {
      mockRedisData[key] = value;
      return Promise.resolve('OK');
    }),
  },
}));

// Mock Prisma
const mockQuizzes: Record<string, any> = {};
const mockSessions: Record<string, any> = {};
jest.mock('../prisma', () => ({
  prisma: {
    session: {
      create: jest.fn((args: any) => {
        const session = {
          id: `session-${Date.now()}`,
          ...args.data,
          createdAt: new Date(),
        };
        mockSessions[session.joinCode] = session;
        return Promise.resolve(session);
      }),
      update: jest.fn((args: any) => {
        const session = mockSessions[args.where.joinCode];
        if (session) {
          Object.assign(session, args.data);
        }
        return Promise.resolve(session);
      }),
    },
    quiz: {
      findUnique: jest.fn((args: any) => {
        return Promise.resolve(mockQuizzes[args.where.id] || null);
      }),
    },
    user: {
      findUnique: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((args: any) => Promise.resolve(args.data)),
    },
  },
}));

describe('GameEngine', () => {
  beforeEach(() => {
    // Clear mocks and data between tests
    jest.clearAllMocks();
    Object.keys(mockRedisData).forEach((key) => delete mockRedisData[key]);
    Object.keys(mockQuizzes).forEach((key) => delete mockQuizzes[key]);
    Object.keys(mockSessions).forEach((key) => delete mockSessions[key]);
  });

  describe('createSession', () => {
    it('should generate a valid 6-digit join code', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      expect(joinCode).toMatch(/^\d{6}$/);
      expect(parseInt(joinCode)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(joinCode)).toBeLessThan(1000000);
    });

    it('should create a database session record', async () => {
      const { prisma } = require('../prisma');
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          joinCode,
          quizId: 'quiz-1',
          hostId: 'host-1',
          status: 'WAITING',
        }),
      });
    });

    it('should initialize Redis game state', async () => {
      const { redis } = require('../redis');
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      expect(redis.set).toHaveBeenCalled();
      const setCall = redis.set.mock.calls[0];
      expect(setCall[0]).toBe(`session:${joinCode}`);

      const state = JSON.parse(setCall[1]);
      expect(state).toMatchObject({
        quizId: 'quiz-1',
        hostId: 'host-1',
        status: 'WAITING',
        currentQuestionIndex: -1,
        players: {},
        answers: {},
        questionStartTime: null,
        startTime: null,
      });
    });
  });

  describe('joinSession', () => {
    beforeEach(async () => {
      // Create a session first
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      mockRedisData['testJoinCode'] = joinCode;
    });

    it('should add a player to the session', async () => {
      const existingCode = Object.keys(mockRedisData).find((k) =>
        k.startsWith('session:')
      );
      const joinCode = existingCode?.replace('session:', '') || '';

      const state = await GameEngine.joinSession(joinCode, 'Player1', 'player-1');

      expect(state.players['player-1']).toEqual({
        id: 'player-1',
        nickname: 'Player1',
        score: 0,
      });
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        GameEngine.joinSession('999999', 'Player1', 'player-1')
      ).rejects.toThrow('Session not found');
    });

    it('should throw error if game already started', async () => {
      const existingCode = Object.keys(mockRedisData).find((k) =>
        k.startsWith('session:')
      );
      const joinCode = existingCode?.replace('session:', '') || '';

      // Modify state to ACTIVE
      const stateRaw = mockRedisData[`session:${joinCode}`];
      const state = JSON.parse(stateRaw);
      state.status = 'ACTIVE';
      mockRedisData[`session:${joinCode}`] = JSON.stringify(state);

      await expect(
        GameEngine.joinSession(joinCode, 'Player1', 'player-1')
      ).rejects.toThrow('Game already started');
    });

    it('should allow multiple players to join', async () => {
      const existingCode = Object.keys(mockRedisData).find((k) =>
        k.startsWith('session:')
      );
      const joinCode = existingCode?.replace('session:', '') || '';

      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      const state = await GameEngine.joinSession(joinCode, 'Player2', 'player-2');

      expect(Object.keys(state.players)).toHaveLength(2);
      expect(state.players['player-1'].nickname).toBe('Player1');
      expect(state.players['player-2'].nickname).toBe('Player2');
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', async () => {
      const result = await GameEngine.getSession('999999');
      expect(result).toBeNull();
    });

    it('should return the session state', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      const state = await GameEngine.getSession(joinCode);

      expect(state).not.toBeNull();
      expect(state?.quizId).toBe('quiz-1');
      expect(state?.hostId).toBe('host-1');
      expect(state?.status).toBe('WAITING');
    });
  });

  describe('getQuizQuestions', () => {
    it('should return empty array for non-existent quiz', async () => {
      const questions = await GameEngine.getQuizQuestions('non-existent');
      expect(questions).toEqual([]);
    });

    it('should return ordered questions', async () => {
      mockQuizzes['quiz-1'] = {
        id: 'quiz-1',
        title: 'Test Quiz',
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            timeLimit: 20,
            order: 0,
          },
          {
            id: 'q2',
            text: 'Question 2',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 1,
            timeLimit: 30,
            order: 1,
          },
        ],
      };

      const questions = await GameEngine.getQuizQuestions('quiz-1');

      expect(questions).toHaveLength(2);
      expect(questions[0].text).toBe('Question 1');
      expect(questions[1].text).toBe('Question 2');
      expect(questions[0].order).toBe(0);
      expect(questions[1].order).toBe(1);
    });
  });

  describe('startGame', () => {
    it('should return null for non-existent session', async () => {
      const result = await GameEngine.startGame('999999');
      expect(result).toBeNull();
    });

    it('should update status to ACTIVE', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      const state = await GameEngine.startGame(joinCode);

      expect(state?.status).toBe('ACTIVE');
      expect(state?.startTime).toBeDefined();
      expect(state?.currentQuestionIndex).toBe(-1);
    });

    it('should update the database session', async () => {
      const { prisma } = require('../prisma');
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      await GameEngine.startGame(joinCode);

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { joinCode },
        data: expect.objectContaining({
          status: 'ACTIVE',
          startedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('nextQuestion', () => {
    beforeEach(() => {
      mockQuizzes['quiz-1'] = {
        id: 'quiz-1',
        title: 'Test Quiz',
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            timeLimit: 20,
            order: 0,
          },
          {
            id: 'q2',
            text: 'Question 2',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 1,
            timeLimit: 30,
            order: 1,
          },
        ],
      };
    });

    it('should throw error for non-existent session', async () => {
      await expect(GameEngine.nextQuestion('999999')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should increment question index', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);

      const { state, question } = await GameEngine.nextQuestion(joinCode);

      expect(state.currentQuestionIndex).toBe(0);
      expect(question?.text).toBe('Question 1');
    });

    it('should clear previous answers', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      // Submit an answer
      await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      // Move to next question
      const { state } = await GameEngine.nextQuestion(joinCode);

      expect(state.answers).toEqual({});
    });

    it('should set status to SHOWING_QUESTION', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);

      const { state } = await GameEngine.nextQuestion(joinCode);

      expect(state.status).toBe('SHOWING_QUESTION');
    });

    it('should return null question and ENDED status when no more questions', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);

      await GameEngine.nextQuestion(joinCode); // Q1
      await GameEngine.nextQuestion(joinCode); // Q2
      const { state, question } = await GameEngine.nextQuestion(joinCode); // End

      expect(question).toBeNull();
      expect(state.status).toBe('ENDED');
    });

    it('should return total questions count', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);

      const { totalQuestions } = await GameEngine.nextQuestion(joinCode);

      expect(totalQuestions).toBe(2);
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      mockQuizzes['quiz-1'] = {
        id: 'quiz-1',
        title: 'Test Quiz',
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            timeLimit: 20,
            order: 0,
          },
        ],
      };
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        GameEngine.submitAnswer('999999', 'player-1', 0)
      ).rejects.toThrow('Session not found');
    });

    it('should throw error if not showing question', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      // Don't call nextQuestion - status is ACTIVE, not SHOWING_QUESTION

      await expect(
        GameEngine.submitAnswer(joinCode, 'player-1', 0)
      ).rejects.toThrow('Not accepting answers');
    });

    it('should throw error for duplicate answer', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      await expect(
        GameEngine.submitAnswer(joinCode, 'player-1', 1)
      ).rejects.toThrow('Already answered');
    });

    it('should return correct=true for correct answer', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      expect(result.correct).toBe(true);
    });

    it('should return correct=false for wrong answer', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 1);

      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should award points for correct answer', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1500); // Max is 1000 + 500 time bonus
    });

    it('should award more points for faster answers (time bonus)', async () => {
      // This test verifies the time bonus formula works:
      // points = 1000 + (timeBonus * 500) where timeBonus = max(0, 1 - (responseTime / timeLimit))
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      // Immediate answer should get max time bonus
      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      // With immediate answer, timeBonus ~= 1, so points should be close to 1500
      expect(result.score).toBeGreaterThanOrEqual(1400);
    });

    it('should update player score', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 0);
      const state = await GameEngine.getSession(joinCode);

      expect(state?.players['player-1'].score).toBe(result.score);
    });

    it('should record the answer', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      await GameEngine.submitAnswer(joinCode, 'player-1', 2);
      const state = await GameEngine.getSession(joinCode);

      expect(state?.answers['player-1']).toMatchObject({
        playerId: 'player-1',
        optionIndex: 2,
      });
      expect(state?.answers['player-1'].responseTimeMs).toBeDefined();
    });
  });

  describe('showResults', () => {
    beforeEach(() => {
      mockQuizzes['quiz-1'] = {
        id: 'quiz-1',
        title: 'Test Quiz',
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 1,
            timeLimit: 20,
            order: 0,
          },
        ],
      };
    });

    it('should throw error for non-existent session', async () => {
      await expect(GameEngine.showResults('999999')).rejects.toThrow(
        'Session not found'
      );
    });

    it('should update status to SHOWING_RESULTS', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const { state } = await GameEngine.showResults(joinCode);

      expect(state.status).toBe('SHOWING_RESULTS');
    });

    it('should return correct answer distribution', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.joinSession(joinCode, 'Player2', 'player-2');
      await GameEngine.joinSession(joinCode, 'Player3', 'player-3');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      await GameEngine.submitAnswer(joinCode, 'player-1', 0); // Wrong
      await GameEngine.submitAnswer(joinCode, 'player-2', 1); // Correct
      await GameEngine.submitAnswer(joinCode, 'player-3', 1); // Correct

      const { answerDistribution, correctCount } =
        await GameEngine.showResults(joinCode);

      expect(answerDistribution).toEqual([1, 2, 0, 0]);
      expect(correctCount).toBe(2);
    });

    it('should return the correct option index', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const { correctOptionIndex } = await GameEngine.showResults(joinCode);

      expect(correctOptionIndex).toBe(1);
    });

    it('should handle no answers gracefully', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const { answerDistribution, correctCount } =
        await GameEngine.showResults(joinCode);

      expect(answerDistribution).toEqual([0, 0, 0, 0]);
      expect(correctCount).toBe(0);
    });
  });

  describe('getLeaderboard', () => {
    it('should return empty array for non-existent session', async () => {
      const leaderboard = await GameEngine.getLeaderboard('999999');
      expect(leaderboard).toEqual([]);
    });

    it('should return players sorted by score descending', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      // Manually set up players with different scores
      const stateRaw = mockRedisData[`session:${joinCode}`];
      const state = JSON.parse(stateRaw);
      state.players = {
        'player-1': { id: 'player-1', nickname: 'Low', score: 100 },
        'player-2': { id: 'player-2', nickname: 'High', score: 500 },
        'player-3': { id: 'player-3', nickname: 'Medium', score: 300 },
      };
      mockRedisData[`session:${joinCode}`] = JSON.stringify(state);

      const leaderboard = await GameEngine.getLeaderboard(joinCode);

      expect(leaderboard[0].nickname).toBe('High');
      expect(leaderboard[0].score).toBe(500);
      expect(leaderboard[1].nickname).toBe('Medium');
      expect(leaderboard[1].score).toBe(300);
      expect(leaderboard[2].nickname).toBe('Low');
      expect(leaderboard[2].score).toBe(100);
    });

    it('should return only top 10 players', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      // Create 15 players
      const stateRaw = mockRedisData[`session:${joinCode}`];
      const state = JSON.parse(stateRaw);
      for (let i = 0; i < 15; i++) {
        state.players[`player-${i}`] = {
          id: `player-${i}`,
          nickname: `Player${i}`,
          score: i * 100,
        };
      }
      mockRedisData[`session:${joinCode}`] = JSON.stringify(state);

      const leaderboard = await GameEngine.getLeaderboard(joinCode);

      expect(leaderboard).toHaveLength(10);
      expect(leaderboard[0].score).toBe(1400); // Highest
      expect(leaderboard[9].score).toBe(500); // 10th highest
    });

    it('should handle tied scores', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');

      const stateRaw = mockRedisData[`session:${joinCode}`];
      const state = JSON.parse(stateRaw);
      state.players = {
        'player-1': { id: 'player-1', nickname: 'Alice', score: 500 },
        'player-2': { id: 'player-2', nickname: 'Bob', score: 500 },
        'player-3': { id: 'player-3', nickname: 'Charlie', score: 500 },
      };
      mockRedisData[`session:${joinCode}`] = JSON.stringify(state);

      const leaderboard = await GameEngine.getLeaderboard(joinCode);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard.every((p) => p.score === 500)).toBe(true);
    });
  });

  describe('endGame', () => {
    it('should do nothing for non-existent session', async () => {
      await expect(GameEngine.endGame('999999')).resolves.toBeUndefined();
    });

    it('should update status to ENDED in Redis', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);

      await GameEngine.endGame(joinCode);
      const state = await GameEngine.getSession(joinCode);

      expect(state?.status).toBe('ENDED');
    });

    it('should update the database session', async () => {
      const { prisma } = require('../prisma');
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.startGame(joinCode);

      await GameEngine.endGame(joinCode);

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { joinCode },
        data: expect.objectContaining({
          status: 'ENDED',
          endedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('Score Calculation Edge Cases', () => {
    beforeEach(() => {
      mockQuizzes['quiz-1'] = {
        id: 'quiz-1',
        title: 'Test Quiz',
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 0,
            timeLimit: 20,
            order: 0,
          },
        ],
      };
    });

    it('should give 0 points for wrong answers', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 3);

      expect(result.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should give between 1000-1500 points for correct answers', async () => {
      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);
      await GameEngine.nextQuestion(joinCode);

      const result = await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      expect(result.correct).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(1000);
      expect(result.score).toBeLessThanOrEqual(1500);
    });

    it('should accumulate scores across multiple questions', async () => {
      mockQuizzes['quiz-1'].questions.push({
        id: 'q2',
        text: 'Question 2',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 2,
        timeLimit: 20,
        order: 1,
      });

      const joinCode = await GameEngine.createSession('quiz-1', 'host-1');
      await GameEngine.joinSession(joinCode, 'Player1', 'player-1');
      await GameEngine.startGame(joinCode);

      // Answer Q1 correctly
      await GameEngine.nextQuestion(joinCode);
      const result1 = await GameEngine.submitAnswer(joinCode, 'player-1', 0);

      // Answer Q2 correctly
      await GameEngine.nextQuestion(joinCode);
      const result2 = await GameEngine.submitAnswer(joinCode, 'player-1', 2);

      const state = await GameEngine.getSession(joinCode);
      expect(state?.players['player-1'].score).toBe(result1.score + result2.score);
    });
  });
});
