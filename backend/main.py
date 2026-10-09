# Backend API for Blackbox AI
# FastAPI server with Firebase Admin authentication

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import firebase_admin
from firebase_admin import credentials, auth
from pydantic import BaseModel
from typing import Optional
import os

# Initialize FastAPI app
app = FastAPI(title="Blackbox AI Backend API")

# Firebase Admin SDK initialization
try:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized successfully")
    else:
        print("⚠️ Firebase credentials file not found. Auth will not work.")
except Exception as e:
    print(f"❌ Failed to initialize Firebase Admin: {e}")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.0/16",  # Local network
        # Add your production domain here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class TokenVerifyRequest(BaseModel):
    token: str

class GDRequest(BaseModel):
    topic: str
    userId: str
    participants: list

# Auth dependency
async def verify_firebase_token(authorization: Optional[str] = Header(None)):
    """Verify Firebase ID token from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    try:
        # Extract token from "Bearer <token>"
        token = authorization.split("Bearer ")[-1] if "Bearer " in authorization else authorization
        
        # Verify token with Firebase Admin
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# Health check
@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Blackbox AI Backend API",
        "version": "1.0.0"
    }

# Health check with auth
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "firebase": firebase_admin._apps.get("[DEFAULT]") is not None
    }

# Verify token endpoint
@app.post("/api/auth/verify")
async def verify_token(request: TokenVerifyRequest):
    """Verify a Firebase ID token"""
    try:
        decoded_token = auth.verify_id_token(request.token)
        return {
            "valid": True,
            "uid": decoded_token["uid"],
            "email": decoded_token.get("email"),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# Protected endpoint example
@app.get("/api/user/profile")
async def get_user_profile(user=Depends(verify_firebase_token)):
    """Get user profile (protected endpoint)"""
    return {
        "uid": user["uid"],
        "email": user.get("email"),
        "name": user.get("name"),
    }

# Group Discussion endpoint (protected)
@app.post("/api/gd/session")
async def create_gd_session(request: GDRequest, user=Depends(verify_firebase_token)):
    """Create a new group discussion session"""
    # Verify user matches request
    if user["uid"] != request.userId:
        raise HTTPException(status_code=403, detail="User ID mismatch")
    
    # GD logic here (integrate with gd_engine)
    return {
        "sessionId": "gd_" + user["uid"],
        "topic": request.topic,
        "participants": request.participants,
        "status": "created"
    }

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
