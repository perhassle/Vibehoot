/**
 * API Route Tests for /api/quizzes
 *
 * Tests the CRUD operations for quizzes.
 */

// Mock Prisma
const mockQuizzes: Map<string, any> = new Map();
const mockQuestions: Map<string, any[]> = new Map();
let idCounter = 1;

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn((args: any) => Promise.resolve(args.data)),
  },
  quiz: {
    create: jest.fn((args: any) => {
      const id = `quiz-${idCounter++}`;
      const quiz = {
        id,
        title: args.data.title,
        ownerId: args.data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuizzes.set(id, quiz);

      // Create questions
      if (args.data.questions?.create) {
        const questions = args.data.questions.create.map((q: any, idx: number) => ({
          id: `question-${idCounter++}`,
          quizId: id,
          ...q,
        }));
        mockQuestions.set(id, questions);
      }

      return Promise.resolve(quiz);
    }),
    findMany: jest.fn(() => {
      const quizzes = Array.from(mockQuizzes.values()).map((quiz) => ({
        ...quiz,
        _count: { questions: mockQuestions.get(quiz.id)?.length || 0 },
      }));
      return Promise.resolve(quizzes.reverse()); // Simulate orderBy createdAt desc
    }),
    findUnique: jest.fn((args: any) => {
      const quiz = mockQuizzes.get(args.where.id);
      if (!quiz) return Promise.resolve(null);
      return Promise.resolve({
        ...quiz,
        questions: (mockQuestions.get(quiz.id) || []).sort(
          (a: any, b: any) => a.order - b.order
        ),
      });
    }),
    update: jest.fn((args: any) => {
      const quiz = mockQuizzes.get(args.where.id);
      if (!quiz) return Promise.reject(new Error('Quiz not found'));

      quiz.title = args.data.title;
      quiz.updatedAt = new Date();

      // Replace questions
      if (args.data.questions?.create) {
        const questions = args.data.questions.create.map((q: any, idx: number) => ({
          id: `question-${idCounter++}`,
          quizId: quiz.id,
          ...q,
        }));
        mockQuestions.set(quiz.id, questions);
      }

      const result = {
        ...quiz,
        questions: (mockQuestions.get(quiz.id) || []).sort(
          (a: any, b: any) => a.order - b.order
        ),
      };

      return Promise.resolve(result);
    }),
    delete: jest.fn((args: any) => {
      const quiz = mockQuizzes.get(args.where.id);
      if (!quiz) return Promise.reject(new Error('Quiz not found'));

      mockQuizzes.delete(args.where.id);
      mockQuestions.delete(args.where.id);

      return Promise.resolve(quiz);
    }),
  },
  question: {
    deleteMany: jest.fn((args: any) => {
      const quizId = args.where.quizId;
      const count = mockQuestions.get(quizId)?.length || 0;
      mockQuestions.delete(quizId);
      return Promise.resolve({ count });
    }),
  },
};

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Import handlers after mocking
import { POST, GET } from '../../src/app/api/quizzes/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '../../src/app/api/quizzes/[id]/route';

describe('Quiz API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuizzes.clear();
    mockQuestions.clear();
    idCounter = 1;

    // Default user mock
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  describe('POST /api/quizzes', () => {
    it('should create a quiz with questions', async () => {
      const requestBody = {
        title: 'Test Quiz',
        questions: [
          {
            text: 'What is 2+2?',
            options: ['3', '4', '5', '6'],
            correctOptionIndex: 1,
            timeLimit: 20,
            type: 'MCQ',
          },
          {
            text: 'What is the capital of France?',
            options: ['London', 'Paris', 'Berlin', 'Madrid'],
            correctOptionIndex: 1,
            timeLimit: 30,
            type: 'MCQ',
          },
        ],
      };

      const request = new Request('http://localhost:3000/api/quizzes', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Test Quiz');
      expect(mockPrisma.quiz.create).toHaveBeenCalled();
    });

    it('should bootstrap user if not exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', questions: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'host-123' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should use existing user if found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'host-123',
        email: 'host@vibehoot.com',
      });

      const request = new Request('http://localhost:3000/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', questions: [] }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/quizzes', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should set question order based on array index', async () => {
      const request = new Request('http://localhost:3000/api/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Ordered Quiz',
          questions: [
            { text: 'Q1', options: ['A'], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' },
            { text: 'Q2', options: ['B'], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' },
            { text: 'Q3', options: ['C'], correctOptionIndex: 0, timeLimit: 20, type: 'MCQ' },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);

      const createCall = mockPrisma.quiz.create.mock.calls[0][0];
      const questions = createCall.data.questions.create;

      expect(questions[0].order).toBe(0);
      expect(questions[1].order).toBe(1);
      expect(questions[2].order).toBe(2);
    });
  });

  describe('GET /api/quizzes', () => {
    it('should return empty array when no quizzes', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return all quizzes with question counts', async () => {
      // Create some quizzes first
      mockQuizzes.set('quiz-1', {
        id: 'quiz-1',
        title: 'Quiz 1',
        createdAt: new Date('2024-01-01'),
      });
      mockQuizzes.set('quiz-2', {
        id: 'quiz-2',
        title: 'Quiz 2',
        createdAt: new Date('2024-01-02'),
      });
      mockQuestions.set('quiz-1', [{}, {}, {}]);
      mockQuestions.set('quiz-2', [{}, {}]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]._count.questions).toBe(2); // quiz-2 (newer)
      expect(data[1]._count.questions).toBe(3); // quiz-1 (older)
    });

    it('should order by createdAt descending', async () => {
      mockQuizzes.set('quiz-old', {
        id: 'quiz-old',
        title: 'Old Quiz',
        createdAt: new Date('2024-01-01'),
      });
      mockQuizzes.set('quiz-new', {
        id: 'quiz-new',
        title: 'New Quiz',
        createdAt: new Date('2024-01-15'),
      });

      const response = await GET();
      const data = await response.json();

      expect(data[0].title).toBe('New Quiz');
      expect(data[1].title).toBe('Old Quiz');
    });
  });

  describe('GET /api/quizzes/[id]', () => {
    it('should return quiz with ordered questions', async () => {
      mockQuizzes.set('quiz-1', {
        id: 'quiz-1',
        title: 'Test Quiz',
        createdAt: new Date(),
      });
      mockQuestions.set('quiz-1', [
        { id: 'q1', text: 'Question 1', order: 0 },
        { id: 'q2', text: 'Question 2', order: 1 },
      ]);

      const request = new Request('http://localhost:3000/api/quizzes/quiz-1');
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'quiz-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Test Quiz');
      expect(data.questions).toHaveLength(2);
      expect(data.questions[0].order).toBe(0);
    });

    it('should return 404 for non-existent quiz', async () => {
      const request = new Request('http://localhost:3000/api/quizzes/non-existent');
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Quiz not found');
    });
  });

  describe('PUT /api/quizzes/[id]', () => {
    beforeEach(() => {
      mockQuizzes.set('quiz-1', {
        id: 'quiz-1',
        title: 'Original Title',
        createdAt: new Date(),
      });
      mockQuestions.set('quiz-1', [{ id: 'q1', text: 'Original Question', order: 0 }]);
    });

    it('should update quiz title', async () => {
      const request = new Request('http://localhost:3000/api/quizzes/quiz-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Title',
          questions: [{ text: 'Q1', options: ['A'], correctOptionIndex: 0, timeLimit: 20 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'quiz-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Title');
    });

    it('should replace all questions (delete then create)', async () => {
      const request = new Request('http://localhost:3000/api/quizzes/quiz-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Quiz',
          questions: [
            { text: 'New Q1', options: ['A'], correctOptionIndex: 0, timeLimit: 20 },
            { text: 'New Q2', options: ['B'], correctOptionIndex: 0, timeLimit: 20 },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await PUT(request, { params: Promise.resolve({ id: 'quiz-1' }) });

      expect(mockPrisma.question.deleteMany).toHaveBeenCalledWith({
        where: { quizId: 'quiz-1' },
      });
    });

    it('should use default values for type and timeLimit', async () => {
      const request = new Request('http://localhost:3000/api/quizzes/quiz-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Quiz',
          questions: [{ text: 'Q', options: ['A'], correctOptionIndex: 0 }],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await PUT(request, { params: Promise.resolve({ id: 'quiz-1' }) });

      const updateCall = mockPrisma.quiz.update.mock.calls[0][0];
      const question = updateCall.data.questions.create[0];

      expect(question.type).toBe('MCQ');
      expect(question.timeLimit).toBe(20);
    });
  });

  describe('DELETE /api/quizzes/[id]', () => {
    beforeEach(() => {
      mockQuizzes.set('quiz-1', {
        id: 'quiz-1',
        title: 'Test Quiz',
        createdAt: new Date(),
      });
    });

    it('should delete a quiz', async () => {
      const request = new Request('http://localhost:3000/api/quizzes/quiz-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'quiz-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.quiz.delete).toHaveBeenCalledWith({
        where: { id: 'quiz-1' },
      });
    });

    it('should handle deletion of non-existent quiz', async () => {
      const request = new Request('http://localhost:3000/api/quizzes/non-existent', {
        method: 'DELETE',
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });

      expect(response.status).toBe(500);
    });
  });
});

describe('Quiz API Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle database errors in POST', async () => {
    mockPrisma.quiz.create.mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', questions: [] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create quiz');
  });

  it('should handle database errors in GET', async () => {
    mockPrisma.quiz.findMany.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed');
  });
});

describe('Quiz Input Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuizzes.clear();
    mockQuestions.clear();
    idCounter = 1;
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'host-123' });

    // Reset quiz.create to working implementation
    mockPrisma.quiz.create.mockImplementation((args: any) => {
      const id = `quiz-${idCounter++}`;
      const quiz = {
        id,
        title: args.data.title,
        ownerId: args.data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockQuizzes.set(id, quiz);

      if (args.data.questions?.create) {
        const questions = args.data.questions.create.map((q: any, idx: number) => ({
          id: `question-${idCounter++}`,
          quizId: id,
          ...q,
        }));
        mockQuestions.set(id, questions);
      }

      return Promise.resolve(quiz);
    });
  });

  it('should handle empty title', async () => {
    const request = new Request('http://localhost:3000/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title: '', questions: [] }),
      headers: { 'Content-Type': 'application/json' },
    });

    // Currently the API doesn't validate empty titles, but we test the behavior
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('should handle empty questions array', async () => {
    const request = new Request('http://localhost:3000/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title: 'No Questions Quiz', questions: [] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.title).toBe('No Questions Quiz');
  });

  it('should handle questions with minimal options', async () => {
    const request = new Request('http://localhost:3000/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Minimal Options',
        questions: [
          {
            text: 'True or False?',
            options: ['True', 'False'],
            correctOptionIndex: 0,
            timeLimit: 10,
            type: 'MCQ',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
