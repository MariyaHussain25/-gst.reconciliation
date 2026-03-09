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
| GET    | `/api/generate-pdf/{reconciliation_id}` | Generate PDF (sync, Phase 8) |
| POST   | `/api/generate-pdf`             | Submit async PDF job (Phase 8) |
| GET    | `/api/reports/{job_id}/status`  | Poll async job status (Phase 8)|
| GET    | `/api/reports/{job_id}/download`| Download completed PDF (Phase 8)|
| GET    | `/api/generate-pdf/by-user/{user_id}/lookup` | List reconciliations (Phase 8)|
| GET    | `/api/generate-pdf/by-user/{user_id}` | Convenience PDF download (Phase 8)|

## Phase Roadmap

| Phase | Description                               | Status      |
|-------|-------------------------------------------|-------------|
| 1     | Backend setup (FastAPI + Beanie)          | ✅ Done      |
| 2     | Excel parsers (GSTR-2A + GSTR-2B)        | ✅ Done      |
| 3     | Upload pipeline + MongoDB storage         | ✅ Done      |
| 4     | Standardization + Invoice normalization   | ✅ Done      |
| 5     | 3-Pass matching engine (RapidFuzz)        | ✅ Done      |
| 6     | RAG/Vector search for GST rules           | 🔲 Planned  |
| 7     | LLM-powered AI explanations (GPT-4o)     | 🔲 Planned  |
| 8     | PDF report generation                     | ✅ Done      |

## System Dependencies for PDF Generation (Phase 8)

The PDF generation feature uses **WeasyPrint** which requires system-level libraries.

### Ubuntu / Debian
```bash
sudo apt-get install -y libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
pip install weasyprint>=62.0
```

### macOS (Homebrew)
```bash
brew install cairo pango gdk-pixbuf libffi
pip install weasyprint>=62.0
```

### Docker
Add to your `Dockerfile`:
```dockerfile
RUN apt-get update && apt-get install -y \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
  && rm -rf /var/lib/apt/lists/*
```

### Switching to Chromium backend (if WeasyPrint deps unavailable)
Set `PDF_BACKEND=chromium` in your `.env` and install:
```bash
pip install playwright
playwright install chromium
```

## Environment Variables

| Variable                 | Required | Description                                         |
|--------------------------|----------|-----------------------------------------------------|
| `MONGODB_URI`            | Yes      | MongoDB Atlas connection string                     |
| `OPENAI_API_KEY`         | Yes      | OpenAI API key for GPT-4o                           |
| `GOOGLE_API_KEY`         | Yes      | Google API key for Gemini LLM (Phase 7)             |
| `GEMINI_MODEL`           | No       | Gemini model name (default: `gemini-1.5-pro`)       |
| `PORT`                   | No       | Server port (default: 3001)                         |
| `MAX_UPLOAD_SIZE_MB`     | No       | Max file upload size (default: 10)                  |
| `ALLOWED_ORIGINS`        | No       | CORS origins (default: localhost)                   |
| `OPENAI_EMBEDDING_MODEL` | No       | OpenAI embedding model (default: `text-embedding-3-small`) |
| `AWS_ACCESS_KEY_ID`      | No       | AWS access key for S3 storage                       |
| `AWS_SECRET_ACCESS_KEY`  | No       | AWS secret key for S3 storage                       |
| `S3_BUCKET_NAME`         | No       | S3 bucket name for file storage                     |
| `PDF_BACKEND`            | No       | PDF engine: `weasy` (default) or `chromium`         |
