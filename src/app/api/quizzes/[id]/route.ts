import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        // Hardcoded ownerId for V1 (assuming single host or implicit host)
        // In a real app, get this from session/auth
        const ownerId = "host-123";
        
        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        // Verify ownership
        if (quiz.ownerId !== ownerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        return NextResponse.json(quiz);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { title, questions } = body;

        // Hardcoded ownerId for V1 (assuming single host or implicit host)
        // In a real app, get this from session/auth
        const ownerId = "host-123";

        // Validate input
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return NextResponse.json({ error: 'Title is required and must be a non-empty string' }, { status: 400 });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'Questions must be a non-empty array' }, { status: 400 });
        }

        // Validate each question
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text || typeof q.text !== 'string') {
                return NextResponse.json({ error: `Question ${i + 1}: text is required` }, { status: 400 });
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                return NextResponse.json({ error: `Question ${i + 1}: must have exactly 4 options` }, { status: 400 });
            }
            if (typeof q.correctOptionIndex !== 'number' || q.correctOptionIndex < 0 || q.correctOptionIndex > 3) {
                return NextResponse.json({ error: `Question ${i + 1}: correctOptionIndex must be 0-3` }, { status: 400 });
            }
            if (typeof q.timeLimit !== 'number' || q.timeLimit < 1) {
                return NextResponse.json({ error: `Question ${i + 1}: timeLimit must be a positive number` }, { status: 400 });
            }
        }

        // Check if quiz exists and verify ownership
        const existingQuiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!existingQuiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        if (existingQuiz.ownerId !== ownerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Delete existing questions and create new ones (replace all)
        await prisma.question.deleteMany({
            where: { quizId: id }
        });

        const quiz = await prisma.quiz.update({
            where: { id },
            data: {
                title,
                questions: {
                    create: questions.map((q: any, index: number) => ({
                        text: q.text,
                        type: q.type || 'MCQ',
                        timeLimit: q.timeLimit || 20,
                        options: q.options,
                        correctOptionIndex: q.correctOptionIndex,
                        order: index
                    }))
                }
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                }
            }
        });

        return NextResponse.json(quiz);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Hardcoded ownerId for V1 (assuming single host or implicit host)
        // In a real app, get this from session/auth
        const ownerId = "host-123";

        // Check if quiz exists and verify ownership
        const existingQuiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!existingQuiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        if (existingQuiz.ownerId !== ownerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        await prisma.quiz.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
    }
}
