from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import uuid
import secrets
import string

router = APIRouter(prefix="/auth", tags=["Authentication"])

class AuthRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str

@router.post("/signup")
async def signup(request: AuthRequest):
    from backend_code.app import supabase
    try:
        # Sign up with Supabase
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password
        })
        
        # Check if user was created
        if not response.user:
            raise HTTPException(status_code=400, detail="Signup failed")
            
        return {
            "success": True,
            "user": {
                "id": response.user.id,
                "email": response.user.email
            },
            "session": {
                "access_token": response.session.access_token if response.session else None,
                "refresh_token": response.session.refresh_token if response.session else None
            }
        }
    except Exception as e:
        # Handle existing user
        if "User already registered" in str(e):
            raise HTTPException(status_code=400, detail="User already registered")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/signin")
async def signin(request: AuthRequest):
    from backend_code.app import supabase
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not response.session:
            raise HTTPException(status_code=401, detail="Email not confirmed")
            
        return {
            "success": True,
            "user": {
                "id": response.user.id,
                "email": response.user.email
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/refresh")
async def refresh_session(request: RefreshRequest):
    from backend_code.app import supabase
    try:
        response = supabase.auth.refresh_session(request.refresh_token)
        
        if not response.session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
            
        return {
            "success": True,
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/guest")
async def guest_login():
    """
    Login as the shared guest user.
    Creates the user if it doesn't exist.
    """
    from backend_code.app import supabase
    
    # Shared guest credentials
    # Shared guest credentials
    GUEST_EMAIL = "Restructguest@gmail.com"
    GUEST_PASSWORD = "Restruct"
    
    try:
        # Try signing in first
        response = supabase.auth.sign_in_with_password({
            "email": GUEST_EMAIL,
            "password": GUEST_PASSWORD
        })
        
        if response.session:
             return {
                "success": True,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "is_guest": True
                },
                "session": {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token
                }
            }
            
    except Exception as e:
        # If sign in fails, try to create the user
        print(f"Guest login failed, trying to create guest user: {e}")
        pass

    try:
        # Create user if not exists or sign in failed
        response = supabase.auth.sign_up({
            "email": GUEST_EMAIL,
            "password": GUEST_PASSWORD,
            "options": {
                "data": {
                    "is_guest": True,
                    "full_name": "Guest User"
                }
            }
        })
        
        # If signup worked (or returned existing user but triggered email confirmation), 
        # check for session.
        session = response.session
        
        # If no session, it might be because the user already exists but we failed to sign in above?
        # Or email confirmation is required.
        
        if not session and response.user:
             # Try signing in again just in case
             auth_response = supabase.auth.sign_in_with_password({
                "email": GUEST_EMAIL,
                "password": GUEST_PASSWORD
            })
             session = auth_response.session
             
        if not session:
             raise HTTPException(status_code=400, detail="Could not establish guest session. Check Supabase 'Confirm Email' settings.")

        return {
            "success": True,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "is_guest": True
            },
            "session": {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token
            }
        }

    except Exception as e:
        print(f"Guest creation error: {e}")
        raise HTTPException(status_code=400, detail=f"Guest login failed: {str(e)}")
