"""
GST Reconciliation Backend — FastAPI Application
Port: 3001
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config.settings import settings
from app.db.connection import connect_db, disconnect_db
from app.routes import upload, process, pdf, rules


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect DB. Shutdown: disconnect DB."""
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(
    title="GST Reconciliation API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — restricted to frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler — never leak stack traces
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "detail": None},
    )

# Routes
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(process.router, prefix="/api", tags=["Process"])
app.include_router(pdf.router, prefix="/api", tags=["PDF"])
app.include_router(rules.router, prefix="/api", tags=["Rules"])


# Health check
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "gst-reconciliation-backend", "version": "0.1.0"}
