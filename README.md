# GST Reconciliation System

A web application for reconciling GST Input Tax Credit (ITC) data across GSTR-2A and GSTR-2B filings.

## Tech Stack

| Layer     | Technology                                      |
|-----------|------------------------------------------------|
| Backend   | Python 3.11 · FastAPI · Beanie (ODM) · Motor   |
| Parsing   | openpyxl                                        |
| Data      | pandas · RapidFuzz                              |
| Validation| Pydantic v2 · pydantic-settings                |
| Database  | MongoDB Atlas                                   |
| Frontend  | Next.js 14 · TypeScript · Tailwind CSS         |

## Project Structure

```
apps/
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── config/   # Settings & env validation
│   │   ├── db/       # MongoDB connection (Motor + Beanie)
│   │   ├── models/   # Beanie document models
│   │   ├── parsers/  # Excel parsers (openpyxl)
│   │   ├── routes/   # FastAPI routers
│   │   ├── schemas/  # Pydantic request/response schemas
│   │   ├── services/ # Business logic
│   │   └── utils/    # Date helpers
│   ├── scripts/      # DB test scripts
│   └── tests/        # pytest tests
└── frontend/         # Next.js frontend (unchanged)
```

## Setup

### Backend
```bash
cd apps/backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MongoDB URI and OpenAI API key
uvicorn app.main:app --port 3001 --reload
```

### Frontend
```bash
cd apps/frontend
pnpm dev
```

## API Endpoints

| Method | Endpoint                        | Description                    |
|--------|---------------------------------|--------------------------------|
| GET    | `/health`                       | Health check                   |
| POST   | `/api/upload-docs`              | Upload GSTR-2A or GSTR-2B file |
| POST   | `/api/process/{user_id}`        | Run reconciliation pipeline    |
| GET    | `/api/generate-pdf/{user_id}/{duration}` | Generate PDF report (Phase 8) |

## Phase Roadmap

| Phase | Description                               | Status      |
|-------|-------------------------------------------|-------------|
| 1     | Backend setup (FastAPI + Beanie)          | ✅ Done      |
| 2     | Excel parsers (GSTR-2A + GSTR-2B)        | ✅ Done      |
| 3     | Upload pipeline + MongoDB storage         | ✅ Done      |
| 4     | Standardization + Invoice normalization   | ✅ Done      |
| 5     | 3-Pass matching engine (RapidFuzz)        | 🔲 Planned  |
| 6     | RAG/Vector search for GST rules           | 🔲 Planned  |
| 7     | LLM-powered AI explanations (GPT-4o)     | 🔲 Planned  |
| 8     | PDF report generation                     | 🔲 Planned  |

## Environment Variables

| Variable              | Required | Description                        |
|-----------------------|----------|------------------------------------|
| `MONGODB_URI`         | Yes      | MongoDB Atlas connection string    |
| `OPENAI_API_KEY`      | Yes      | OpenAI API key for GPT-4o          |
| `PORT`                | No       | Server port (default: 3001)        |
| `MAX_UPLOAD_SIZE_MB`  | No       | Max file upload size (default: 10) |
| `ALLOWED_ORIGINS`     | No       | CORS origins (default: localhost)  |
