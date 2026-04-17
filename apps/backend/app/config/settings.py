"""
Environment variable validation using pydantic-settings.
All required environment variables are validated on startup.
The application will raise a validation error if any required variable is missing.
"""

from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

# Always resolve .env relative to the backend root, not the cwd
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent  # apps/backend/


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Required
    MONGODB_URI: str = Field(..., description="MongoDB Atlas connection string")
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key for GPT-4o")

    # Optional - Cloud storage (Phase 3)
    AWS_ACCESS_KEY_ID: str | None = Field(default=None)
    AWS_SECRET_ACCESS_KEY: str | None = Field(default=None)
    S3_BUCKET_NAME: str | None = Field(default=None)
    S3_ENDPOINT_URL: str | None = Field(default=None, description="S3-compatible endpoint URL (e.g. Cloudflare R2)")

    # Server
    PORT: int = Field(default=3001, description="HTTP port the server listens on")

    # Security
    MAX_UPLOAD_SIZE_MB: int = Field(default=10, description="Maximum file upload size in MB")
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000"],
        description="CORS allowed origins"
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> list[str]:
        """Accept either a JSON array or a comma-separated string from .env."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v  # type: ignore[return-value]

    SECRET_KEY: str = Field(default="change-me-in-production", description="JWT signing secret key")

    # Phase 7 — Gemini model for AI explanations
    # "Gemini 1.5 Pro" is the valid Google model ID closest to the requested "Gemini Pro".
    GOOGLE_API_KEY: str | None = Field(default=None, description="Google API key for Gemini AI explanations")
    OPENAI_EMBEDDING_MODEL: str = Field(default="text-embedding-3-small", description="OpenAI embedding model for vector generation")
    GEMINI_MODEL: str = Field(default="gemini-2.0-flash", description="Google Gemini chat model for AI explanations")

    # Phase 8 — PDF generation
    PDF_BACKEND: str = Field(default="weasy", description="PDF backend: 'weasy' or 'chromium'")

    model_config = {
        "env_file": str(_BACKEND_ROOT / ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
