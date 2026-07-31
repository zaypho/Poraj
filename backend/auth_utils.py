import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import PyJWTError
from passlib.context import CryptContext

from db import users_col

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
# Admin sessions are deliberately short-lived (rotation) — the dashboard asks
# for a fresh sign-in once the window lapses.
ADMIN_SESSION_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, *, admin: bool = False, admin_ver: int = 0) -> str:
    now = datetime.now(timezone.utc)
    if admin:
        payload = {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(minutes=ADMIN_SESSION_MINUTES),
            "kind": "admin",
            "ver": admin_ver,
        }
    else:
        payload = {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_payload(token: str) -> dict:
    """Full verified JWT payload (raises PyJWTError on invalid/expired)."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def decode_token(token: str) -> str:
    """Returns user_id or raises PyJWTError."""
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    sub = payload.get("sub")
    if not sub:
        raise PyJWTError("Missing subject")
    return sub


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = decode_token(token)
    except PyJWTError:
        raise credentials_exception
    user = await users_col.find_one({"_id": user_id})
    if user is None:
        raise credentials_exception
    if user.get("banned"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been banned.",
        )
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]
