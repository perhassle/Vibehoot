# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibehoot is a real-time multiplayer quiz game (Kahoot clone) built with Next.js 16, Socket.io, Prisma, and Redis.

## Commands

```bash
# Start development server (custom server with Socket.io)
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint
npm run lint

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Prisma commands
npx prisma generate    # Generate client after schema changes
npx prisma db push     # Push schema to database
npx prisma studio      # Open database GUI
```

## Architecture

### Custom Server (`server.ts`)
The app uses a custom HTTP server that integrates Next.js with Socket.io. All WebSocket events are handled here:
- `create_game` - Host creates a new game session
- `join_game` - Player joins with a 6-digit code
- `start_game` - Host starts the quiz

### Game State Management
- **Prisma/PostgreSQL**: Persistent storage for Users, Quizzes, Questions, and Sessions
- **Redis**: Real-time game state (players, scores, current question) stored as `session:{joinCode}`

### Key Files
- `src/lib/game-engine.ts` - Core game logic (create/join sessions, manage state)
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/redis.ts` - Redis client

### Routes
- `/` - Landing page
- `/host/dashboard` - Host's quiz management
- `/host/create` - Create new quiz
- `/host/game/[id]` - Host game control view
- `/play` - Player join page
- `/api/quizzes` - Quiz CRUD API

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://vibehoot:vibehoot_password@localhost:5432/vibehoot_db
REDIS_URL=redis://localhost:6379
```
