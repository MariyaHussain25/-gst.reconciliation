"""
Authentication dependencies for FastAPI.

Uses JWT tokens signed with SECRET_KEY for secure user identification.
The bearer token is decoded using python-jose; the subject claim (sub)
is used as the user_id.

BEFORE PRODUCTION: Ensure SECRET_KEY is a long random string stored securely
in environment variables and never committed to source control.
"""

from fastapi import Header, HTTPException
from typing import Optional

from app.models.reconciliation import Reconciliation
from app.services.auth_service import decode_access_token


async def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> str:
    """
    Extract and return the user_id from an incoming request.

    Priority:
    1. `Authorization: Bearer <token>` — JWT token is decoded and the ``sub``
       claim is used as the user_id.
    2. `X-User-Id: <user_id>` — development fallback header.

    Raises:
        HTTPException(401): If neither header is present or the token is invalid.
    """
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
            user_id = decode_access_token(token)
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            return user_id

    if x_user_id:
        return x_user_id.strip()

    raise HTTPException(status_code=401, detail="Authentication required")


async def verify_reconciliation_ownership(
    reconciliation_id: str,
    current_user_id: str,
) -> Reconciliation:
    """
    Fetch a Reconciliation and verify that it belongs to `current_user_id`.

    Security note: Both "not found" and "wrong owner" cases return HTTP 404
    to prevent user enumeration — an attacker cannot distinguish between a
    reconciliation that does not exist and one that belongs to another user.

    Args:
        reconciliation_id: The UUID of the reconciliation to look up.
        current_user_id:   The authenticated caller's user_id.

    Returns:
        The matching :class:`Reconciliation` document.

    Raises:
        HTTPException(404): If not found *or* if found but owned by a
                            different user (deliberate ambiguity).
    """
    reconciliation = await Reconciliation.find_one(
        Reconciliation.reconciliation_id == reconciliation_id
    )
    # Return 404 for both "not found" and "wrong owner" to avoid leaking
    # the existence of reconciliations belonging to other users.
    if reconciliation is None or reconciliation.user_id != current_user_id:
        raise HTTPException(
            status_code=404,
            detail="Reconciliation not found",
        )
    return reconciliation
