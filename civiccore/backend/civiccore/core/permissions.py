"""
CivicCore - Generic Role-Based Access Control (RBAC)
"""
from functools import wraps
from typing import List, Callable, Any
from fastapi import HTTPException, status
from ..modules.membership.models import Member

def require_role(roles: List[str]):
    """
    Decorator to require specific roles for an endpoint.
    Usage:
    @router.get("/")
    @require_role(["admin", "founder"])
    def my_endpoint(current_user: Member = Depends(get_current_user)):
        ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )
            
            if current_user.role not in roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have the required role to perform this action"
                )
                
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_status(statuses: List[str]):
    """
    Decorator to require specific member statuses.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated"
                )
            
            if current_user.status not in statuses:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Action not allowed for status: {current_user.status}"
                )
                
            return await func(*args, **kwargs)
        return wrapper
    return decorator
