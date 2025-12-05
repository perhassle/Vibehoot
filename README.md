# Vibehoot

Real-time multiplayer quiz game - Kahoot clone built with Next.js, Socket.io, Prisma and Redis.

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Install dependencies
npm install

# Start infrastructure
docker-compose up -d

# Generate Prisma client and push schema
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## JSON Import Format

You can import quiz questions using JSON. Go to **Host Dashboard** → **Create New Quiz** → **Import JSON**.

### Format

```json
[
  {
    "question": "What is the primary purpose of SEO?",
    "options": [
      "Increase paid ad visibility",
      "Improve organic search visibility",
      "Replace social media marketing",
      "Track competitor budgets"
    ],
    "correct_index": 1
  },
  {
    "question": "Which factor is most important for on-page SEO?",
    "options": [
      "Keyword relevance",
      "Image file size only",
      "Having as many pages as possible",
      "Using multiple domains"
    ],
    "correct_index": 0
  }
]
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `question` | string | The question text |
| `options` | string[] | Array of 2-4 answer options |
| `correct_index` | number | Index of the correct answer (0-based) |

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- **Frontend**: Next.js 16, React 19
- **Real-time**: Socket.io
- **Database**: PostgreSQL with Prisma
- **Cache**: Redis
- **Testing**: Playwright
