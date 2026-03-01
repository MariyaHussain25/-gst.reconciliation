 # GST Reconciliation System

> AI-powered GST Reconciliation & Input Tax Credit (ITC) Automation System for Indian businesses.

---

## Overview

This system automates the reconciliation of purchase books against GSTR-2A/2B returns using a multi-pass matching engine, an ITC eligibility rules engine powered by MongoDB Atlas Vector Search and RAG, and AI-assisted decision making via GPT-4o.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| Package Manager | pnpm |
| Node Version | v22 LTS |
| Backend | Hono.js + TypeScript |
| Frontend | Next.js 15 (App Router) + shadcn/ui + Tailwind CSS v4 |
| Database | MongoDB Atlas + Vector Search |
| LLM | OpenAI GPT-4o (via Vercel AI SDK) |
| RAG | LlamaIndex.TS + MongoDB Atlas Vector Search |
| Fuzzy Matching | Fuse.js |
| PDF Reports | @react-pdf/renderer |
| Validation | Zod |

---

## Project Structure

```
gst-reconciliation/
├── apps/
│   ├── backend/          ← Hono.js API (port 3001)
│   └── frontend/         ← Next.js 15 App (port 3000)
├── packages/
│   └── shared/           ← Shared TypeScript types & Zod schemas
├── turbo.json            ← Turborepo pipeline config
├── pnpm-workspace.yaml   ← pnpm workspaces
└── package.json          ← Root scripts
```

---

## Getting Started

### Prerequisites

- Node.js v22 LTS
- pnpm v9+

```bash
npm install -g pnpm
```

### Installation

```bash
# Install all dependencies from root
pnpm install
```

### Development

```bash
# Start both backend and frontend in watch mode
pnpm dev
```

- Backend API: http://localhost:3001
- Frontend: http://localhost:3000
- Health check: http://localhost:3001/health

### Build

```bash
pnpm build
```

### Lint & Type Check

```bash
pnpm lint
pnpm type-check
```

### Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example apps/backend/.env
```

Required variables:
- `MONGODB_URI` — MongoDB Atlas connection string
- `OPENAI_API_KEY` — OpenAI API key for GPT-4o
- `PORT` — Backend port (default: 3001)
- `NODE_ENV` — development | production | test

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |
| POST | `/api/v1/upload-docs` | Upload purchase books & GSTR files |
| POST | `/api/v1/process/:userId` | Run reconciliation pipeline |
| GET | `/api/v1/generatePdf/:userId/:duration` | Generate PDF report |

---

## Phase Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 1** | Project Scaffold (Turborepo, Hono, Next.js, models, services) | ✅ Complete |
| **Phase 2** | Database Models & Connection (MongoDB Atlas, indexes) | 🔜 Upcoming |
| **Phase 3** | File Upload API + UI (multipart upload, S3/local storage) | 🔜 Upcoming |
| **Phase 4** | Data Standardization & Parsing (CSV/Excel/PDF parsing, normalization) | 🔜 Upcoming |
| **Phase 5** | 3-Pass Invoice Matching Engine (exact → fuzzy → AI) | 🔜 Upcoming |
| **Phase 6** | ITC Rules Engine + RAG Setup (Vector Search, rule retrieval) | 🔜 Upcoming |
| **Phase 7** | AI Layer (GPT-4o matching, ITC categorization, NLP reports) | 🔜 Upcoming |
| **Phase 8** | PDF Generation & Final Reports (@react-pdf/renderer) | 🔜 Upcoming |

---

## License

MIT
