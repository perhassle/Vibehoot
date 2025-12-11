/**
 * Player Page Component Tests
 *
 * Tests the player experience: joining games, answering questions,
 * viewing results and leaderboards.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerApp from '../page';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

// Mock CSS module
jest.mock('../page.module.css', () => ({
  container: 'container',
  card: 'card',
  logo: 'logo',
  input: 'input',
  joinBtn: 'joinBtn',
  center: 'center',
  blink: 'blink',
  nickname: 'nickname',
  waitingText: 'waitingText',
  questionScreen: 'questionScreen',
  questionInfo: 'questionInfo',
  answersGrid: 'answersGrid',
  answerBtn: 'answerBtn',
  resultIcon: 'resultIcon',
  correct: 'correct',
  wrong: 'wrong',
  scoreGain: 'scoreGain',
  totalScore: 'totalScore',
  leaderboardScreen: 'leaderboardScreen',
  myRank: 'myRank',
  endedScreen: 'endedScreen',
  gameOver: 'gameOver',
  finalRank: 'finalRank',
  finalScore: 'finalScore',
  finalNickname: 'finalNickname',
}));

describe('PlayerApp Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.on.mockReset();
    mockSocket.emit.mockReset();
  });

  describe('Join Screen', () => {
    it('should render join form with inputs', () => {
      render(<PlayerApp />);

      expect(screen.getByPlaceholderText('Game PIN')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nickname')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join game/i })).toBeInTheDocument();
    });

    it('should render VIBEHOOT logo', () => {
      render(<PlayerApp />);
      expect(screen.getByText('VIBEHOOT')).toBeInTheDocument();
    });

    it('should update join code input', async () => {
      const user = userEvent.setup();
      render(<PlayerApp />);

      const pinInput = screen.getByPlaceholderText('Game PIN');
      await user.type(pinInput, '123456');

      expect(pinInput).toHaveValue('123456');
    });

    it('should update nickname input', async () => {
      const user = userEvent.setup();
      render(<PlayerApp />);

      const nicknameInput = screen.getByPlaceholderText('Nickname');
      await user.type(nicknameInput, 'TestPlayer');

      expect(nicknameInput).toHaveValue('TestPlayer');
    });

    it('should limit game PIN to 6 characters', () => {
      render(<PlayerApp />);

      const pinInput = screen.getByPlaceholderText('Game PIN');
      expect(pinInput).toHaveAttribute('maxLength', '6');
    });

    it('should limit nickname to 20 characters', () => {
      render(<PlayerApp />);

      const nicknameInput = screen.getByPlaceholderText('Nickname');
      expect(nicknameInput).toHaveAttribute('maxLength', '20');
    });

    it('should not join if fields are empty', async () => {
      const user = userEvent.setup();
      render(<PlayerApp />);

      const joinButton = screen.getByRole('button', { name: /join game/i });
      await user.click(joinButton);

      // Socket should not be created if fields are empty
      expect(require('socket.io-client').io).not.toHaveBeenCalled();
    });

    it('should initiate socket connection on join', async () => {
      const user = userEvent.setup();
      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      expect(require('socket.io-client').io).toHaveBeenCalled();
    });
  });

  describe('Socket Event Handlers', () => {
    const setupSocketHandlers = () => {
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });
      return handlers;
    };

    it('should emit join_game on socket connect', async () => {
      const user = userEvent.setup();
      const handlers = setupSocketHandlers();

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      // Trigger connect event
      handlers['connect']?.();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'join_game',
        expect.objectContaining({
          joinCode: '123456',
          nickname: 'Player1',
        }),
        expect.any(Function)
      );
    });

    it('should transition to WAITING on successful join', async () => {
      const user = userEvent.setup();
      const handlers = setupSocketHandlers();

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      // Trigger connect
      handlers['connect']?.();

      // Simulate successful callback
      const emitCall = mockSocket.emit.mock.calls.find(
        (call) => call[0] === 'join_game'
      );
      const callback = emitCall?.[2];
      callback?.({ success: true, state: {} });

      await waitFor(() => {
        expect(screen.getByText("You're in!")).toBeInTheDocument();
      });
    });

    it('should show alert on failed join', async () => {
      const user = userEvent.setup();
      const handlers = setupSocketHandlers();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();

      const emitCall = mockSocket.emit.mock.calls.find(
        (call) => call[0] === 'join_game'
      );
      const callback = emitCall?.[2];
      callback?.({ success: false, error: 'Session not found' });

      expect(alertMock).toHaveBeenCalledWith('Failed to join: Session not found');
      alertMock.mockRestore();
    });
  });

  describe('Waiting Screen', () => {
    it('should display player nickname', async () => {
      const user = userEvent.setup();
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'TestPlayer');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();
      const callback = mockSocket.emit.mock.calls[0]?.[2];
      callback?.({ success: true });

      await waitFor(() => {
        expect(screen.getByText('TestPlayer')).toBeInTheDocument();
      });
    });

    it('should show waiting message', async () => {
      const user = userEvent.setup();
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();
      const callback = mockSocket.emit.mock.calls[0]?.[2];
      callback?.({ success: true });

      await waitFor(() => {
        expect(screen.getByText('Waiting for host to start...')).toBeInTheDocument();
      });
    });
  });

  describe('Question Screen', () => {
    const setupQuestionState = async () => {
      const user = userEvent.setup();
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      render(<PlayerApp />);

      // Join game
      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();
      const joinCallback = mockSocket.emit.mock.calls[0]?.[2];
      joinCallback?.({ success: true });

      return { handlers, user };
    };

    it('should display question info when question starts', async () => {
      const { handlers } = await setupQuestionState();

      handlers['question_start']?.({
        text: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        timeLimit: 20,
        questionIndex: 0,
        totalQuestions: 5,
      });

      await waitFor(() => {
        expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
      });
    });

    it('should render 4 answer buttons', async () => {
      const { handlers } = await setupQuestionState();

      handlers['question_start']?.({
        text: 'Test Question',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20,
        questionIndex: 0,
        totalQuestions: 1,
      });

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(4);
      });
    });

    it('should submit answer when button clicked', async () => {
      const { handlers, user } = await setupQuestionState();

      handlers['question_start']?.({
        text: 'Test Question',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20,
        questionIndex: 0,
        totalQuestions: 1,
      });

      await waitFor(() => {
        expect(screen.getAllByRole('button')).toHaveLength(4);
      });

      const buttons = screen.getAllByRole('button');
      await user.click(buttons[1]); // Click second option

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'submit_answer',
        expect.objectContaining({
          joinCode: '123456',
          optionIndex: 1,
        }),
        expect.any(Function)
      );
    });

    it('should prevent double answer submission', async () => {
      const { handlers, user } = await setupQuestionState();

      handlers['question_start']?.({
        text: 'Test Question',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20,
        questionIndex: 0,
        totalQuestions: 1,
      });

      await waitFor(() => {
        expect(screen.getAllByRole('button')).toHaveLength(4);
      });

      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);

      // Clear mock to check second click
      const firstEmitCount = mockSocket.emit.mock.calls.filter(
        (call) => call[0] === 'submit_answer'
      ).length;

      await user.click(buttons[1]);

      const secondEmitCount = mockSocket.emit.mock.calls.filter(
        (call) => call[0] === 'submit_answer'
      ).length;

      expect(secondEmitCount).toBe(firstEmitCount); // No additional emit
    });
  });

  describe('Result Screens', () => {
    const setupAnsweredState = async () => {
      const user = userEvent.setup();
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true });

      handlers['question_start']?.({
        text: 'Test',
        options: ['A', 'B', 'C', 'D'],
        timeLimit: 20,
        questionIndex: 0,
        totalQuestions: 1,
      });

      await waitFor(() => {
        expect(screen.getAllByRole('button')).toHaveLength(4);
      });

      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);

      // Simulate answer callback
      const answerCall = mockSocket.emit.mock.calls.find(
        (call) => call[0] === 'submit_answer'
      );
      answerCall?.[2]?.({ success: true, correct: true, score: 1500 });

      return { handlers, user };
    };

    it('should show correct result after answering', async () => {
      await setupAnsweredState();

      await waitFor(() => {
        expect(screen.getByText('Correct!')).toBeInTheDocument();
      });
    });

    it('should show score gain for correct answer', async () => {
      await setupAnsweredState();

      await waitFor(() => {
        expect(screen.getByText('+1500 points')).toBeInTheDocument();
      });
    });

    it('should accumulate total score', async () => {
      await setupAnsweredState();

      await waitFor(() => {
        expect(screen.getByText('Total: 1500')).toBeInTheDocument();
      });
    });
  });

  describe('Leaderboard Screen', () => {
    it('should display player rank', async () => {
      const user = userEvent.setup();
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true });

      // Trigger leaderboard
      handlers['leaderboard_update']?.({
        leaderboard: [
          { id: 'other-id', nickname: 'Other', score: 2000 },
          { id: expect.any(String), nickname: 'Player1', score: 1500 },
        ],
      });

      await waitFor(() => {
        expect(screen.getByText('Leaderboard')).toBeInTheDocument();
      });
    });
  });

  describe('Game Ended Screen', () => {
    it('should display final results', async () => {
      const user = userEvent.setup();
      const handlers: Record<string, Function> = {};
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        handlers[event] = handler;
      });

      render(<PlayerApp />);

      await user.type(screen.getByPlaceholderText('Game PIN'), '123456');
      await user.type(screen.getByPlaceholderText('Nickname'), 'Player1');
      await user.click(screen.getByRole('button', { name: /join game/i }));

      handlers['connect']?.();
      mockSocket.emit.mock.calls[0]?.[2]?.({ success: true });

      handlers['game_ended']?.({
        leaderboard: [{ id: 'player-id', nickname: 'Player1', score: 5000 }],
      });

      await waitFor(() => {
        expect(screen.getByText('Game Over!')).toBeInTheDocument();
      });
    });
  });
});
