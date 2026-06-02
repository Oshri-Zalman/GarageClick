"""Auth routes (TDD §4.1)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginRequest
from ..security import create_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username))

    # Same 401 for unknown user and wrong password (no user enumeration).
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials.")

    token = create_token(user_id=user.id, role=user.role)
    return {
        "token": token,
        "user_id": user.id,
        "role": user.role,
        "full_name": user.full_name,
    }


@router.get("/verify-token")
def verify_token(user: dict = Depends(get_current_user)):
    return {"valid": True, "user_id": user["user_id"], "role": user["role"]}
