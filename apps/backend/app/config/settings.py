"""
Environment variable validation using pydantic-settings.
All required environment variables are validated on startup.
The application will raise a validation error if any required variable is missing.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Required
    MONGODB_URI: str = Field(..., description="MongoDB Atlas connection string")
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key for GPT-4o")

    # Optional - Cloud storage (Phase 3)
    AWS_ACCESS_KEY_ID: str | None = Field(default=None)
    AWS_SECRET_ACCESS_KEY: str | None = Field(default=None)
    S3_BUCKET_NAME: str | None = Field(default=None)

    # Server
    PORT: int = Field(default=3001, description="HTTP port the server listens on")

    # Security
    MAX_UPLOAD_SIZE_MB: int = Field(default=10, description="Maximum file upload size in MB")
    ALLOWED_ORIGINS: list[str] = Field(
        default=["http://localhost:3000"],
        description="CORS allowed origins"
    )

    # Phase 7 — LLM model for AI explanations
    OPENAI_LLM_MODEL: str = Field(default="gpt-4o-mini", description="OpenAI chat model for AI explanations")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
