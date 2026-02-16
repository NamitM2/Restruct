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
        # If sign in fails, check why
        signin_error = str(e)  # Capture for debugging
        error_msg = signin_error.lower()
        print(f"DEBUG: Guest sign-in failed with error: '{signin_error}'")
        
        # If credentials are wrong, don't try to sign up
        if "invalid login credentials" in error_msg:
             raise HTTPException(status_code=401, detail=f"Guest login failed: Invalid credentials. Verification check: Password='{GUEST_PASSWORD}'")
        
        if "email not confirmed" in error_msg:
             raise HTTPException(status_code=400, detail="Guest login failed: Email not confirmed.")

        print(f"DEBUG: Falling back to signup due to unexpected error: {signin_error}")

    try:
        # Create user
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
        
        session = response.session
        if not session and response.user:
             # Try signing in again
             auth_response = supabase.auth.sign_in_with_password({
                "email": GUEST_EMAIL,
                "password": GUEST_PASSWORD
            })
             session = auth_response.session
             
        if not session:
             raise HTTPException(status_code=400, detail="Guest session could not be established.")

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
        # Return BOTH errors for debugging
        raise HTTPException(status_code=400, detail=f"Guest login failed. Sign-in error: [{signin_error}]. Sign-up error: [{str(e)}]")
