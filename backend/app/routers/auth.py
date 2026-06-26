"""Auth routes (TDD §4.1)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import LoginRequest, PasswordChange
from ..security import create_token, hash_password, revoke, verify_password

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

    # Record the login time (FR-6.1 last_login for the manager dashboard).
    user.last_login = func.now()
    db.commit()

    return {
        "token": token,
        "user_id": user.id,
        "role": user.role,
        "full_name": user.full_name,
    }


@router.get("/verify-token")
def verify_token(user: dict = Depends(get_current_user)):
    return {"valid": True, "user_id": user["user_id"], "role": user["role"]}


@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    """Revoke the caller's token so it can no longer be used (TDD §4.1)."""
    revoke(user.get("jti"))
    return {"success": True}


@router.post("/change-password")
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Let the logged-in user change their own password (current -> new)."""
    db_user = db.get(User, user["user_id"])
    if db_user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if not verify_password(body.current_password, db_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")

    db_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"success": True}
