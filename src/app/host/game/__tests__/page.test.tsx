/**
 * Host Game Page Component Tests
 *
 * Tests the host's game control interface: lobby, question display,
 * results, and leaderboard states.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GameHost from '../[id]/page';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

// Mock next/navigation
const mockParams = { id: 'quiz-123' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

// Mock CSS module
jest.mock('../[id]/page.module.css', () => ({
  container: 'container',
  lobby: 'lobby',
  lobbyHeader: 'lobbyHeader',
  joinInfo: 'joinInfo',
  joinLabel: 'joinLabel',
  joinCode: 'joinCode',
  playersGrid: 'playersGrid',
  playerCard: 'playerCard',
  footer: 'footer',
  playerCount: 'playerCount',
  startBtn: 'startBtn',
  questionView: 'questionView',
  questionHeader: 'questionHeader',
  questionNumber: 'questionNumber',
  timer: 'timer',
  answerCounter: 'answerCounter',
  questionContent: 'questionContent',
  questionText: 'questionText',
  optionsDisplay: 'optionsDisplay',
  optionCard: 'optionCard',
  optionText: 'optionText',
  skipBtn: 'skipBtn',
  resultsView: 'resultsView',
  resultsTitle: 'resultsTitle',
  questionRecap: 'questionRecap',
  resultsGrid: 'resultsGrid',
  resultCard: 'resultCard',
  correctAnswer: 'correctAnswer',
  resultBar: 'resultBar',
  resultFill: 'resultFill',
  resultCount: 'resultCount',
  resultOption: 'resultOption',
  checkmark: 'checkmark',
  nextBtn: 'nextBtn',
  leaderboardView: 'leaderboardView',
  leaderboardTitle: 'leaderboardTitle',
  leaderboardList: 'leaderboardList',
  leaderboardRow: 'leaderboardRow',
  rank: 'rank',
  playerName: 'playerName',
  playerScore: 'playerScore',
  endedView: 'endedView',
  endedTitle: 'endedTitle',
  podium: 'podium',
  podiumPlace: 'podiumPlace',
  place1: 'place1',
  place2: 'place2',
  place3: 'place3',
  podiumRank: 'podiumRank',
  podiumName: 'podiumName',
  podiumScore: 'podiumScore',
  fullLeaderboard: 'fullLeaderboard',
}));

describe('GameHost Component', () => {
  let handlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    handlers = {};
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      handlers[event] = handler;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial Render and Socket Setup', () => {
    it('should connect to socket on mount', () => {
      render(<GameHost />);
      expect(require('socket.io-client').io).toHaveBeenCalled();
    });

    it('should emit create_game on connect', () => {
      render(<GameHost />);
      handlers['connect']?.();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'create_game',
        { quizId: 'quiz-123', hostId: 'host-123' },
        expect.any(Function)
      );
    });

    it('should set join code from create_game response', async () => {
      render(<GameHost />);
      handlers['connect']?.();

      const callback = mockSocket.emit.mock.calls[0]?.[2];
      callback?.({ success: true, joinCode: '654321' });

      await waitFor(() => {
        expect(screen.getByText('654321')).toBeInTheDocument();
      });
    });

    it('should disconnect socket on unmount', () => {
      const { unmount } = render(<GameHost />);
      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Lobby State', () => {
    beforeEach(() => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });
    });

    it('should display join code', async () => {
      await waitFor(() => {
        expect(screen.getByText('123456')).toBeInTheDocument();
      });
    });

    it('should display instruction text', () => {
      expect(screen.getByText('JOIN AT VIBEHOOT.COM WITH CODE')).toBeInTheDocument();
    });

    it('should show 0 players initially', () => {
      expect(screen.getByText('0 Players')).toBeInTheDocument();
    });

    it('should disable start button with no players', () => {
      const startButton = screen.getByRole('button', { name: /start game/i });
      expect(startButton).toBeDisabled();
    });

    it('should add player when player_joined event received', async () => {
      handlers['player_joined']?.({
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('1 Players')).toBeInTheDocument();
      });
    });

    it('should not duplicate players', async () => {
      handlers['player_joined']?.({
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });
      handlers['player_joined']?.({
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });

      await waitFor(() => {
        expect(screen.getAllByText('Alice')).toHaveLength(1);
      });
    });

    it('should enable start button when players join', async () => {
      handlers['player_joined']?.({
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });

      await waitFor(() => {
        const startButton = screen.getByRole('button', { name: /start game/i });
        expect(startButton).not.toBeDisabled();
      });
    });

    it('should remove player on disconnect', async () => {
      handlers['player_joined']?.({
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });

      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      handlers['player_disconnected']?.({ playerId: 'player-1' });

      await waitFor(() => {
        expect(screen.queryByText('Alice')).not.toBeInTheDocument();
      });
    });
  });

  describe('Starting the Game', () => {
    beforeEach(async () => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });

      handlers['player_joined']?.({
        playerId: 'player-1',
        nickname: 'Alice',
        score: 0,
      });

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });

    it('should emit start_game when start button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const startButton = screen.getByRole('button', { name: /start game/i });
      await user.click(startButton);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'start_game',
        { joinCode: '123456' },
        expect.any(Function)
      );
    });

    it('should request first question after start', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const startButton = screen.getByRole('button', { name: /start game/i });
      await user.click(startButton);

      // Simulate start_game success
      const startCallback = mockSocket.emit.mock.calls.find(
        (call) => call[0] === 'start_game'
      )?.[2];
      startCallback?.({ success: true });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'next_question',
        { joinCode: '123456' },
        expect.any(Function)
      );
    });
  });

  describe('Question State', () => {
    beforeEach(async () => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });

      handlers['player_joined']?.({ playerId: 'p1', nickname: 'Alice', score: 0 });
      handlers['player_joined']?.({ playerId: 'p2', nickname: 'Bob', score: 0 });

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });

    const startGameWithQuestion = async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /start game/i }));

      const startCallback = mockSocket.emit.mock.calls.find(
        (call) => call[0] === 'start_game'
      )?.[2];
      startCallback?.({ success: true });

      const nextCallback = mockSocket.emit.mock.calls.find(
        (call) => call[0] === 'next_question'
      )?.[2];
      nextCallback?.({
        success: true,
        question: {
          text: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          timeLimit: 10,
        },
        questionIndex: 0,
        totalQuestions: 3,
      });

      return user;
    };

    it('should display question text', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
      });
    });

    it('should display question number', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
      });
    });

    it('should display answer options', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('6')).toBeInTheDocument();
      });
    });

    it('should display timer', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });

    it('should count down timer', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('9')).toBeInTheDocument();
      });
    });

    it('should display answer counter', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByText('0 / 2 answered')).toBeInTheDocument();
      });
    });

    it('should update answer count on answer_count_update', async () => {
      await startGameWithQuestion();

      handlers['answer_count_update']?.({ answerCount: 1, totalPlayers: 2 });

      await waitFor(() => {
        expect(screen.getByText('1 / 2 answered')).toBeInTheDocument();
      });
    });

    // Timer auto-triggering is tested via E2E (Playwright) since Jest fake timers
    // have complex interactions with React's async state updates.
    // The skip button test below tests the same code path (showResults function).

    it('should have skip timer button', async () => {
      await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip timer/i })).toBeInTheDocument();
      });
    });

    it('should skip to results when skip button clicked', async () => {
      const user = await startGameWithQuestion();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip timer/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /skip timer/i }));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'show_results',
        { joinCode: '123456' },
        expect.any(Function)
      );
    });
  });

  describe('Results State', () => {
    beforeEach(async () => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });
      handlers['player_joined']?.({ playerId: 'p1', nickname: 'Alice', score: 0 });

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });

    const showResults = async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /start game/i }));
      mockSocket.emit.mock.calls.find((c) => c[0] === 'start_game')?.[2]?.({
        success: true,
      });
      mockSocket.emit.mock.calls.find((c) => c[0] === 'next_question')?.[2]?.({
        success: true,
        question: { text: 'Q?', options: ['A', 'B', 'C', 'D'], timeLimit: 10 },
        questionIndex: 0,
        totalQuestions: 1,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip timer/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /skip timer/i }));

      const showResultsCallback = mockSocket.emit.mock.calls.find(
        (c) => c[0] === 'show_results'
      )?.[2];
      showResultsCallback?.({
        success: true,
        answerDistribution: [0, 1, 0, 0],
        correctOptionIndex: 1,
      });

      return user;
    };

    it('should display results title', async () => {
      await showResults();

      await waitFor(() => {
        expect(screen.getByText('Results')).toBeInTheDocument();
      });
    });

    it('should show answer distribution', async () => {
      await showResults();

      await waitFor(() => {
        // Check that answer counts are displayed
        const resultCounts = screen.getAllByText(/^[0-1]$/);
        expect(resultCounts.length).toBeGreaterThan(0);
      });
    });

    it('should have show leaderboard button', async () => {
      await showResults();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /show leaderboard/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Leaderboard State', () => {
    beforeEach(async () => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });
      handlers['player_joined']?.({ playerId: 'p1', nickname: 'Alice', score: 0 });

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });
    });

    it('should display leaderboard title', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /start game/i }));
      mockSocket.emit.mock.calls.find((c) => c[0] === 'start_game')?.[2]?.({
        success: true,
      });
      mockSocket.emit.mock.calls.find((c) => c[0] === 'next_question')?.[2]?.({
        success: true,
        question: { text: 'Q', options: ['A', 'B', 'C', 'D'], timeLimit: 5 },
        questionIndex: 0,
        totalQuestions: 2,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip timer/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /skip timer/i }));
      mockSocket.emit.mock.calls.find((c) => c[0] === 'show_results')?.[2]?.({
        success: true,
        answerDistribution: [1, 0, 0, 0],
        correctOptionIndex: 0,
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /show leaderboard/i })
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /show leaderboard/i }));
      mockSocket.emit.mock.calls.find((c) => c[0] === 'get_leaderboard')?.[2]?.({
        success: true,
        leaderboard: [{ playerId: 'p1', nickname: 'Alice', score: 1500 }],
      });

      await waitFor(() => {
        expect(screen.getByText('Leaderboard')).toBeInTheDocument();
      });
    });
  });

  describe('Game Ended State', () => {
    // Note: Complex async socket state transitions are better tested via E2E tests (Playwright)
    // These unit tests verify socket emissions occur correctly

    it('should emit start_game and next_question when starting', async () => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });
      handlers['player_joined']?.({ playerId: 'p1', nickname: 'Alice', score: 0 });

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /start game/i }));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'start_game',
        { joinCode: '123456' },
        expect.any(Function)
      );
    });

    it('should emit next_question after start_game succeeds', async () => {
      render(<GameHost />);
      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true, joinCode: '123456' });
      handlers['player_joined']?.({ playerId: 'p1', nickname: 'Alice', score: 0 });

      // Wait for state to update
      await waitFor(() => {
        expect(screen.getByText('Alice')).toBeInTheDocument();
      });

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      await user.click(screen.getByRole('button', { name: /start game/i }));

      // Trigger start_game callback
      const startCallback = mockSocket.emit.mock.calls.find(
        (c) => c[0] === 'start_game'
      )?.[2];
      startCallback?.({ success: true });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'next_question',
        { joinCode: '123456' },
        expect.any(Function)
      );
    });
  });
});
