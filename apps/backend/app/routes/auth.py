"""
Authentication routes — register and login endpoints.
POST /api/auth/register  — create a new user account
POST /api/auth/login     — authenticate and receive a JWT bearer token
"""

import uuid

from fastapi import APIRouter, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
from pydantic import BaseModel, EmailStr

from app.models.user import User
from app.services.auth_service import get_password_hash, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    """Create a new user account with a hashed password."""
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        user_id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=get_password_hash(body.password),
        is_active=True,
    )
    await user.insert()
    return {"message": "User created successfully", "user_id": user.user_id}


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticate with email + password and return a JWT bearer token."""
    user = await User.find_one(User.email == form_data.username)
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_access_token({"sub": user.user_id})
    return TokenResponse(access_token=token)
