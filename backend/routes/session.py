"""Session endpoints for the optional access token."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from security import AUTH_COOKIE, access_token, auth_required, is_authenticated, session_value

router = APIRouter(prefix="/api", tags=["session"])


class Login(BaseModel):
    token: str


@router.get("/session")
async def session_status(request: Request):
    return {"auth_required": auth_required(), "authenticated": is_authenticated(request) if auth_required() else True}


@router.post("/session")
async def login(body: Login, request: Request, response: Response):
    token = access_token()
    if not token:
        raise HTTPException(status_code=400, detail="This deployment has no access token configured")
    if not hmac.compare_digest(body.token.strip(), token):
        raise HTTPException(status_code=401, detail="Invalid access token")
    response.set_cookie(AUTH_COOKIE, session_value(token), max_age=60 * 60 * 24 * 7, httponly=True, samesite="lax",
                        secure=request.url.scheme == "https")
    return {"authenticated": True}
