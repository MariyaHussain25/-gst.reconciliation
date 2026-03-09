"""
Authentication dependencies for FastAPI.

SECURITY WARNING: This module implements a STUB bearer-token authentication
that is intentionally simplified for development. The current implementation
treats the bearer token directly as the user_id (or decodes it from base64).

BEFORE PRODUCTION: Replace `get_current_user_id` with real JWT validation
(e.g. using `python-jose` or `authlib`) that verifies signature, expiry,
issuer, and audience claims.
"""

from fastapi import Header, HTTPException
from typing import Optional
import base64

from app.models.reconciliation import Reconciliation


async def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
) -> str:
    """
    Extract and return the user_id from an incoming request.

    Priority:
    1. `Authorization: Bearer <token>` — token is treated as user_id directly,
       or decoded from base64 if it is valid base64.
    2. `X-User-Id: <user_id>` — development fallback header.

    Raises:
        HTTPException(401): If neither header is present.
    """
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
            # Attempt base64 decode; fall back to raw token value.
            try:
                user_id = base64.b64decode(token + "==").decode("utf-8").strip()
                if not user_id:
                    user_id = token
            except Exception:
                user_id = token
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
