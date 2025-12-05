import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        await prisma.quiz.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
    }
}
