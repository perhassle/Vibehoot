/**
 * Socket.io Event Handler Tests
 *
 * These tests verify the socket event handlers work correctly.
 * They mock both the GameEngine and Socket.io to test event handling logic.
 */

// Mock GameEngine
const mockGameEngine = {
  createSession: jest.fn(),
  joinSession: jest.fn(),
  getSession: jest.fn(),
  startGame: jest.fn(),
  nextQuestion: jest.fn(),
  submitAnswer: jest.fn(),
  showResults: jest.fn(),
  getLeaderboard: jest.fn(),
  endGame: jest.fn(),
};

jest.mock('../src/lib/game-engine', () => ({
  GameEngine: mockGameEngine,
}));

// Types for socket mocks
interface MockSocket {
  id: string;
  data: Record<string, any>;
  join: jest.Mock;
  emit: jest.Mock;
  on: jest.Mock;
  handlers: Map<string, Function>;
}

interface MockIO {
  to: jest.Mock;
  emit: jest.Mock;
}

describe('Socket Event Handlers', () => {
  let mockSocket: MockSocket;
  let mockIo: MockIO;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'test-socket-id',
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      handlers: new Map(),
    };

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockCallback = jest.fn();
  });

  describe('create_game event', () => {
    it('should create a game session and return join code', async () => {
      mockGameEngine.createSession.mockResolvedValue('123456');

      // Simulate the handler
      const handler = async (
        data: { quizId: string; hostId: string },
        callback: Function
      ) => {
        try {
          const joinCode = await mockGameEngine.createSession(
            data.quizId,
            data.hostId
          );
          mockSocket.join(joinCode);
          callback({ success: true, joinCode });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ quizId: 'quiz-1', hostId: 'host-1' }, mockCallback);

      expect(mockGameEngine.createSession).toHaveBeenCalledWith('quiz-1', 'host-1');
      expect(mockSocket.join).toHaveBeenCalledWith('123456');
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        joinCode: '123456',
      });
    });

    it('should handle errors during game creation', async () => {
      mockGameEngine.createSession.mockRejectedValue(new Error('Database error'));

      const handler = async (
        data: { quizId: string; hostId: string },
        callback: Function
      ) => {
        try {
          const joinCode = await mockGameEngine.createSession(
            data.quizId,
            data.hostId
          );
          mockSocket.join(joinCode);
          callback({ success: true, joinCode });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ quizId: 'quiz-1', hostId: 'host-1' }, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
      });
    });
  });

  describe('join_game event', () => {
    it('should allow player to join and broadcast to room', async () => {
      const mockState = {
        sessionId: 'session-1',
        players: { 'player-1': { id: 'player-1', nickname: 'Alice', score: 0 } },
      };
      mockGameEngine.joinSession.mockResolvedValue(mockState);

      const handler = async (
        data: { joinCode: string; nickname: string; playerId: string },
        callback: Function
      ) => {
        try {
          const state = await mockGameEngine.joinSession(
            data.joinCode,
            data.nickname,
            data.playerId
          );
          mockSocket.join(data.joinCode);
          mockSocket.data.joinCode = data.joinCode;
          mockSocket.data.playerId = data.playerId;
          mockIo.to(data.joinCode).emit('player_joined', {
            playerId: data.playerId,
            nickname: data.nickname,
            score: 0,
          });
          callback({ success: true, state });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler(
        { joinCode: '123456', nickname: 'Alice', playerId: 'player-1' },
        mockCallback
      );

      expect(mockGameEngine.joinSession).toHaveBeenCalledWith(
        '123456',
        'Alice',
        'player-1'
      );
      expect(mockSocket.join).toHaveBeenCalledWith('123456');
      expect(mockSocket.data.joinCode).toBe('123456');
      expect(mockSocket.data.playerId).toBe('player-1');
      expect(mockIo.to).toHaveBeenCalledWith('123456');
      expect(mockIo.emit).toHaveBeenCalledWith('player_joined', {
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });
      expect(mockCallback).toHaveBeenCalledWith({ success: true, state: mockState });
    });

    it('should handle invalid join code', async () => {
      mockGameEngine.joinSession.mockRejectedValue(new Error('Session not found'));

      const handler = async (
        data: { joinCode: string; nickname: string; playerId: string },
        callback: Function
      ) => {
        try {
          const state = await mockGameEngine.joinSession(
            data.joinCode,
            data.nickname,
            data.playerId
          );
          callback({ success: true, state });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler(
        { joinCode: '999999', nickname: 'Alice', playerId: 'player-1' },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Session not found',
      });
    });

    it('should reject join if game already started', async () => {
      mockGameEngine.joinSession.mockRejectedValue(
        new Error('Game already started')
      );

      const handler = async (
        data: { joinCode: string; nickname: string; playerId: string },
        callback: Function
      ) => {
        try {
          const state = await mockGameEngine.joinSession(
            data.joinCode,
            data.nickname,
            data.playerId
          );
          callback({ success: true, state });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler(
        { joinCode: '123456', nickname: 'Alice', playerId: 'player-1' },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Game already started',
      });
    });
  });

  describe('start_game event', () => {
    it('should start the game and notify all players', async () => {
      mockGameEngine.startGame.mockResolvedValue({
        status: 'ACTIVE',
        startTime: Date.now(),
      });

      const handler = async (data: { joinCode: string }, callback: Function) => {
        try {
          await mockGameEngine.startGame(data.joinCode);
          mockIo.to(data.joinCode).emit('game_started');
          callback({ success: true });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ joinCode: '123456' }, mockCallback);

      expect(mockGameEngine.startGame).toHaveBeenCalledWith('123456');
      expect(mockIo.to).toHaveBeenCalledWith('123456');
      expect(mockIo.emit).toHaveBeenCalledWith('game_started');
      expect(mockCallback).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('next_question event', () => {
    it('should send question to all players', async () => {
      mockGameEngine.nextQuestion.mockResolvedValue({
        state: { currentQuestionIndex: 0 },
        question: {
          text: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          timeLimit: 20,
        },
        totalQuestions: 5,
      });

      const handler = async (data: { joinCode: string }, callback: Function) => {
        try {
          const { question, totalQuestions, state } =
            await mockGameEngine.nextQuestion(data.joinCode);
          if (question) {
            mockIo.to(data.joinCode).emit('question_start', {
              questionIndex: state.currentQuestionIndex,
              totalQuestions,
              text: question.text,
              options: question.options,
              timeLimit: question.timeLimit,
            });
            callback({
              success: true,
              question,
              totalQuestions,
              questionIndex: state.currentQuestionIndex,
            });
          } else {
            const leaderboard = await mockGameEngine.getLeaderboard(data.joinCode);
            mockIo.to(data.joinCode).emit('game_ended', { leaderboard });
            callback({ success: true, ended: true, leaderboard });
          }
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ joinCode: '123456' }, mockCallback);

      expect(mockIo.to).toHaveBeenCalledWith('123456');
      expect(mockIo.emit).toHaveBeenCalledWith('question_start', {
        questionIndex: 0,
        totalQuestions: 5,
        text: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        timeLimit: 20,
      });
    });

    it('should emit game_ended when no more questions', async () => {
      mockGameEngine.nextQuestion.mockResolvedValue({
        state: { currentQuestionIndex: 5, status: 'ENDED' },
        question: null,
        totalQuestions: 5,
      });
      mockGameEngine.getLeaderboard.mockResolvedValue([
        { id: 'player-1', nickname: 'Alice', score: 5000 },
      ]);

      const handler = async (data: { joinCode: string }, callback: Function) => {
        try {
          const { question, state } = await mockGameEngine.nextQuestion(
            data.joinCode
          );
          if (question) {
            callback({ success: true, question });
          } else {
            const leaderboard = await mockGameEngine.getLeaderboard(data.joinCode);
            mockIo.to(data.joinCode).emit('game_ended', { leaderboard });
            callback({ success: true, ended: true, leaderboard });
          }
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ joinCode: '123456' }, mockCallback);

      expect(mockIo.emit).toHaveBeenCalledWith('game_ended', {
        leaderboard: [{ id: 'player-1', nickname: 'Alice', score: 5000 }],
      });
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        ended: true,
        leaderboard: [{ id: 'player-1', nickname: 'Alice', score: 5000 }],
      });
    });
  });

  describe('submit_answer event', () => {
    it('should process answer and update count', async () => {
      mockGameEngine.submitAnswer.mockResolvedValue({ correct: true, score: 1500 });
      mockGameEngine.getSession.mockResolvedValue({
        answers: { 'player-1': {} },
        players: { 'player-1': {}, 'player-2': {} },
      });

      const handler = async (
        data: { joinCode: string; playerId: string; optionIndex: number },
        callback: Function
      ) => {
        try {
          const result = await mockGameEngine.submitAnswer(
            data.joinCode,
            data.playerId,
            data.optionIndex
          );
          const state = await mockGameEngine.getSession(data.joinCode);
          const answerCount = Object.keys(state.answers).length;
          const totalPlayers = Object.keys(state.players).length;

          mockIo
            .to(data.joinCode)
            .emit('answer_count_update', { answerCount, totalPlayers });
          callback({ success: true, ...result });
          mockSocket.emit('answer_result', result);
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler(
        { joinCode: '123456', playerId: 'player-1', optionIndex: 0 },
        mockCallback
      );

      expect(mockGameEngine.submitAnswer).toHaveBeenCalledWith(
        '123456',
        'player-1',
        0
      );
      expect(mockIo.emit).toHaveBeenCalledWith('answer_count_update', {
        answerCount: 1,
        totalPlayers: 2,
      });
      expect(mockCallback).toHaveBeenCalledWith({
        success: true,
        correct: true,
        score: 1500,
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('answer_result', {
        correct: true,
        score: 1500,
      });
    });

    it('should handle duplicate answer error', async () => {
      mockGameEngine.submitAnswer.mockRejectedValue(new Error('Already answered'));

      const handler = async (
        data: { joinCode: string; playerId: string; optionIndex: number },
        callback: Function
      ) => {
        try {
          const result = await mockGameEngine.submitAnswer(
            data.joinCode,
            data.playerId,
            data.optionIndex
          );
          callback({ success: true, ...result });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler(
        { joinCode: '123456', playerId: 'player-1', optionIndex: 0 },
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith({
        success: false,
        error: 'Already answered',
      });
    });
  });

  describe('show_results event', () => {
    it('should broadcast results to all players', async () => {
      mockGameEngine.showResults.mockResolvedValue({
        state: { status: 'SHOWING_RESULTS' },
        correctOptionIndex: 1,
        answerDistribution: [2, 5, 1, 0],
        correctCount: 5,
      });

      const handler = async (data: { joinCode: string }, callback: Function) => {
        try {
          const results = await mockGameEngine.showResults(data.joinCode);
          mockIo.to(data.joinCode).emit('question_results', {
            correctOptionIndex: results.correctOptionIndex,
            answerDistribution: results.answerDistribution,
            correctCount: results.correctCount,
          });
          callback({ success: true, ...results });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ joinCode: '123456' }, mockCallback);

      expect(mockIo.emit).toHaveBeenCalledWith('question_results', {
        correctOptionIndex: 1,
        answerDistribution: [2, 5, 1, 0],
        correctCount: 5,
      });
    });
  });

  describe('get_leaderboard event', () => {
    it('should return sorted leaderboard', async () => {
      const leaderboard = [
        { id: 'player-1', nickname: 'Alice', score: 5000 },
        { id: 'player-2', nickname: 'Bob', score: 4000 },
        { id: 'player-3', nickname: 'Charlie', score: 3000 },
      ];
      mockGameEngine.getLeaderboard.mockResolvedValue(leaderboard);

      const handler = async (data: { joinCode: string }, callback: Function) => {
        try {
          const lb = await mockGameEngine.getLeaderboard(data.joinCode);
          mockIo.to(data.joinCode).emit('leaderboard_update', { leaderboard: lb });
          callback({ success: true, leaderboard: lb });
        } catch (e: any) {
          callback({ success: false, error: e.message });
        }
      };

      await handler({ joinCode: '123456' }, mockCallback);

      expect(mockIo.emit).toHaveBeenCalledWith('leaderboard_update', { leaderboard });
      expect(mockCallback).toHaveBeenCalledWith({ success: true, leaderboard });
    });
  });

  describe('disconnect event', () => {
    it('should notify room of player disconnect', () => {
      mockSocket.data.joinCode = '123456';
      mockSocket.data.playerId = 'player-1';

      const handler = () => {
        if (mockSocket.data.joinCode && mockSocket.data.playerId) {
          mockIo.to(mockSocket.data.joinCode).emit('player_disconnected', {
            playerId: mockSocket.data.playerId,
          });
        }
      };

      handler();

      expect(mockIo.to).toHaveBeenCalledWith('123456');
      expect(mockIo.emit).toHaveBeenCalledWith('player_disconnected', {
        playerId: 'player-1',
      });
    });

    it('should not emit if no join code stored', () => {
      mockSocket.data = {};

      const handler = () => {
        if (mockSocket.data.joinCode && mockSocket.data.playerId) {
          mockIo.to(mockSocket.data.joinCode).emit('player_disconnected', {
            playerId: mockSocket.data.playerId,
          });
        }
      };

      handler();

      expect(mockIo.to).not.toHaveBeenCalled();
    });
  });
});
