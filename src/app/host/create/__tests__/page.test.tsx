/**
 * Quiz Creator Page Component Tests
 *
 * Tests the quiz creation interface: adding questions, JSON import,
 * form validation, and saving.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateQuiz from '../page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

// Mock CSS module
jest.mock('../page.module.css', () => ({
  container: 'container',
  header: 'header',
  titleInput: 'titleInput',
  headerActions: 'headerActions',
  importBtn: 'importBtn',
  saveBtn: 'saveBtn',
  modalOverlay: 'modalOverlay',
  modal: 'modal',
  importTitleInput: 'importTitleInput',
  jsonStatus: 'jsonStatus',
  validStatus: 'validStatus',
  invalidStatus: 'invalidStatus',
  jsonTextarea: 'jsonTextarea',
  validBorder: 'validBorder',
  invalidBorder: 'invalidBorder',
  errorText: 'errorText',
  modalActions: 'modalActions',
  cancelBtn: 'cancelBtn',
  confirmBtn: 'confirmBtn',
  questionsList: 'questionsList',
  questionCard: 'questionCard',
  cardHeader: 'cardHeader',
  timeInput: 'timeInput',
  secondsLabel: 'secondsLabel',
  questionInput: 'questionInput',
  optionsGrid: 'optionsGrid',
  optionRow: 'optionRow',
  correct: 'correct',
  optionMarker: 'optionMarker',
  addBtn: 'addBtn',
}));

describe('CreateQuiz Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'new-quiz-id' }),
    });
  });

  describe('Initial Render', () => {
    it('should render quiz title input', () => {
      render(<CreateQuiz />);
      expect(screen.getByPlaceholderText('Enter Quiz Title...')).toBeInTheDocument();
    });

    it('should render Import JSON button', () => {
      render(<CreateQuiz />);
      expect(screen.getByRole('button', { name: /import json/i })).toBeInTheDocument();
    });

    it('should render Save Quiz button', () => {
      render(<CreateQuiz />);
      expect(screen.getByRole('button', { name: /save quiz/i })).toBeInTheDocument();
    });

    it('should render one empty question by default', () => {
      render(<CreateQuiz />);
      expect(screen.getByText('Question 1')).toBeInTheDocument();
    });

    it('should render Add Question button', () => {
      render(<CreateQuiz />);
      expect(screen.getByRole('button', { name: /\+ add question/i })).toBeInTheDocument();
    });

    it('should have 4 option inputs per question', () => {
      render(<CreateQuiz />);
      expect(screen.getByPlaceholderText('Option 1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Option 2')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Option 4')).toBeInTheDocument();
    });

    it('should have default time limit of 20 seconds', () => {
      render(<CreateQuiz />);
      const timeInput = screen.getByDisplayValue('20');
      expect(timeInput).toBeInTheDocument();
    });
  });

  describe('Quiz Title', () => {
    it('should update title on input', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      const titleInput = screen.getByPlaceholderText('Enter Quiz Title...');
      await user.type(titleInput, 'My Test Quiz');

      expect(titleInput).toHaveValue('My Test Quiz');
    });
  });

  describe('Question Management', () => {
    it('should add a new question when Add Question clicked', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      const addButton = screen.getByRole('button', { name: /\+ add question/i });
      await user.click(addButton);

      expect(screen.getByText('Question 1')).toBeInTheDocument();
      expect(screen.getByText('Question 2')).toBeInTheDocument();
    });

    it('should update question text', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      const questionInput = screen.getByPlaceholderText('Question text?');
      await user.type(questionInput, 'What is 2+2?');

      expect(questionInput).toHaveValue('What is 2+2?');
    });

    it('should update option text', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      const optionInput = screen.getByPlaceholderText('Option 1');
      await user.type(optionInput, 'Four');

      expect(optionInput).toHaveValue('Four');
    });

    it('should update time limit', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      const timeInput = screen.getByDisplayValue('20');
      await user.clear(timeInput);
      await user.type(timeInput, '30');

      expect(timeInput).toHaveValue(30);
    });

    it('should select correct answer on option click', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      // Fill in options first
      const options = [
        screen.getByPlaceholderText('Option 1'),
        screen.getByPlaceholderText('Option 2'),
        screen.getByPlaceholderText('Option 3'),
        screen.getByPlaceholderText('Option 4'),
      ];

      await user.type(options[0], 'A');
      await user.type(options[1], 'B');
      await user.type(options[2], 'C');
      await user.type(options[3], 'D');

      // Click on second option row to select it as correct
      const optionRows = document.querySelectorAll('[class*="optionRow"]');
      await user.click(optionRows[1]);

      // The second option should now be marked as correct
      expect(optionRows[1]).toHaveClass('correct');
    });
  });

  describe('JSON Import Modal', () => {
    it('should open modal when Import JSON clicked', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      expect(screen.getByText('Import Questions from JSON')).toBeInTheDocument();
    });

    it('should close modal when Cancel clicked', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));
      expect(screen.getByText('Import Questions from JSON')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Import Questions from JSON')).not.toBeInTheDocument();
      });
    });

    it('should close modal when clicking overlay', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      const overlay = document.querySelector('[class*="modalOverlay"]');
      await user.click(overlay!);

      await waitFor(() => {
        expect(screen.queryByText('Import Questions from JSON')).not.toBeInTheDocument();
      });
    });

    it('should require quiz title for import', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      // Try to import without title
      await user.click(screen.getByRole('button', { name: /import questions/i }));

      expect(screen.getByText('Quiz title is required')).toBeInTheDocument();
    });

    it('should validate JSON format', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      // Find textarea by its tag name (there's only one textarea in the modal)
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'invalid json' } });

      await waitFor(() => {
        expect(screen.getByText(/invalid json format/i)).toBeInTheDocument();
      });
    });

    it('should show valid status for correct JSON', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      const validJson = JSON.stringify([
        {
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correct_index: 1,
        },
      ]);

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: validJson } });

      await waitFor(() => {
        expect(screen.getByText(/valid json/i)).toBeInTheDocument();
        expect(screen.getByText(/1 question/i)).toBeInTheDocument();
      });
    });

    it('should import questions from valid JSON', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      // Enter title
      const titleInput = screen.getByPlaceholderText('Quiz Title (required)');
      await user.type(titleInput, 'Imported Quiz');

      // Enter valid JSON
      const validJson = JSON.stringify([
        {
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correct_index: 1,
        },
        {
          question: 'What is 3+3?',
          options: ['5', '6', '7', '8'],
          correct_index: 1,
        },
      ]);

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: validJson } });

      await user.click(screen.getByRole('button', { name: /import questions/i }));

      // Modal should close and questions should be imported
      await waitFor(() => {
        expect(screen.queryByText('Import Questions from JSON')).not.toBeInTheDocument();
      });

      // Quiz title should be set
      expect(screen.getByDisplayValue('Imported Quiz')).toBeInTheDocument();

      // Questions should be imported
      expect(screen.getByText('Question 1')).toBeInTheDocument();
      expect(screen.getByText('Question 2')).toBeInTheDocument();
    });

    it('should show error for invalid question format', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      const titleInput = screen.getByPlaceholderText('Quiz Title (required)');
      await user.type(titleInput, 'Test Quiz');

      // Missing required fields
      const invalidJson = JSON.stringify([{ text: 'Missing fields' }]);

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: invalidJson } });

      await user.click(screen.getByRole('button', { name: /import questions/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid question format/i)).toBeInTheDocument();
      });
    });

    it('should reject empty JSON array', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      const titleInput = screen.getByPlaceholderText('Quiz Title (required)');
      await user.type(titleInput, 'Test Quiz');

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '[]' } });

      await user.click(screen.getByRole('button', { name: /import questions/i }));

      await waitFor(() => {
        expect(screen.getByText(/must contain at least one question/i)).toBeInTheDocument();
      });
    });

    it('should reject non-array JSON', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.click(screen.getByRole('button', { name: /import json/i }));

      const titleInput = screen.getByPlaceholderText('Quiz Title (required)');
      await user.type(titleInput, 'Test Quiz');

      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '{"question": "test"}' } });

      await user.click(screen.getByRole('button', { name: /import questions/i }));

      await waitFor(() => {
        expect(screen.getByText(/must be an array/i)).toBeInTheDocument();
      });
    });
  });

  describe('Saving Quiz', () => {
    it('should call API on save', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      // Fill in quiz
      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'Test Quiz');
      await user.type(screen.getByPlaceholderText('Question text?'), 'What is 2+2?');
      await user.type(screen.getByPlaceholderText('Option 1'), '3');
      await user.type(screen.getByPlaceholderText('Option 2'), '4');
      await user.type(screen.getByPlaceholderText('Option 3'), '5');
      await user.type(screen.getByPlaceholderText('Option 4'), '6');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      expect(global.fetch).toHaveBeenCalledWith('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      });
    });

    it('should send correct data structure', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'My Quiz');
      await user.type(screen.getByPlaceholderText('Question text?'), 'Q1?');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toMatchObject({
        title: 'My Quiz',
        questions: expect.arrayContaining([
          expect.objectContaining({
            text: 'Q1?',
            type: 'MCQ',
            timeLimit: 20,
          }),
        ]),
      });
    });

    it('should redirect to dashboard on success', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'Test');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/host/dashboard');
      });
    });

    it('should show alert on save failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed' }),
      });

      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'Test');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Failed to save');
      });

      alertMock.mockRestore();
    });

    it('should show Saving... while saving', async () => {
      let resolvePromise: Function;
      (global.fetch as jest.Mock).mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'Test');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

      // Cleanup
      resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'Test');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Error saving');
      });

      alertMock.mockRestore();
    });
  });

  describe('Multiple Questions', () => {
    it('should add multiple questions', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      const addButton = screen.getByRole('button', { name: /\+ add question/i });

      await user.click(addButton);
      await user.click(addButton);
      await user.click(addButton);

      expect(screen.getByText('Question 1')).toBeInTheDocument();
      expect(screen.getByText('Question 2')).toBeInTheDocument();
      expect(screen.getByText('Question 3')).toBeInTheDocument();
      expect(screen.getByText('Question 4')).toBeInTheDocument();
    });

    it('should save all questions', async () => {
      const user = userEvent.setup();
      render(<CreateQuiz />);

      await user.type(screen.getByPlaceholderText('Enter Quiz Title...'), 'Multi Q');

      // Add second question
      await user.click(screen.getByRole('button', { name: /\+ add question/i }));

      // Fill first question
      const questionInputs = screen.getAllByPlaceholderText('Question text?');
      await user.type(questionInputs[0], 'First question');
      await user.type(questionInputs[1], 'Second question');

      await user.click(screen.getByRole('button', { name: /save quiz/i }));

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.questions).toHaveLength(2);
      expect(body.questions[0].text).toBe('First question');
      expect(body.questions[1].text).toBe('Second question');
    });
  });
});
