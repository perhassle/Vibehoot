import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ensure this path is correct based on your previous file creation

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, questions } = body;

        // Hardcoded ownerId for V1 (assuming single host or implicit host)
        // In a real app, get this from session/auth
        const ownerId = "host-123";

        // Ensure User exists (bootstrap)
        let user = await prisma.user.findUnique({ where: { id: ownerId } });
        if (!user) {
            // Create dummy host if not exists (for prototype simplicity)
            user = await prisma.user.create({
                data: {
                    id: ownerId,
                    email: "host@vibehoot.com",
                    passwordHash: "dummy",
                    role: "HOST"
                }
            });
        }

        const quiz = await prisma.quiz.create({
            data: {
                title,
                ownerId: user.id,
                questions: {
                    create: questions.map((q: any, index: number) => ({
                        text: q.text,
                        type: q.type,
                        timeLimit: q.timeLimit,
                        options: q.options,
                        correctOptionIndex: q.correctOptionIndex,
                        order: index
                    }))
                }
            }
        });

        return NextResponse.json(quiz);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const quizzes = await prisma.quiz.findMany({
            include: { _count: { select: { questions: true } } },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(quizzes);
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
