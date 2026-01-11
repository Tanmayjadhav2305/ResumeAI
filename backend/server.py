from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import secrets
from pypdf import PdfReader
import io
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
FREE_TIER_LIMIT = 3
MAGIC_LINK_EXPIRY = 3600  # 1 hour

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    usage_count: int = 0
    magic_link_token: Optional[str] = None
    magic_link_expiry: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ResumeAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    resume_text: str
    analysis_result: dict
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MagicLinkRequest(BaseModel):
    email: EmailStr

class MagicLinkVerify(BaseModel):
    token: str

class ResumeTextRequest(BaseModel):
    resume_text: str
    role_target: Optional[str] = None

class AuthResponse(BaseModel):
    user_id: str
    email: str
    usage_count: int
    usage_limit: int

# Helper functions
async def get_user_by_email(email: str):
    user_data = await db.users.find_one({"email": email}, {"_id": 0})
    if user_data:
        if isinstance(user_data.get('created_at'), str):
            user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
        if isinstance(user_data.get('magic_link_expiry'), str):
            user_data['magic_link_expiry'] = datetime.fromisoformat(user_data['magic_link_expiry'])
    return user_data

async def get_user_by_id(user_id: str):
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_data:
        if isinstance(user_data.get('created_at'), str):
            user_data['created_at'] = datetime.fromisoformat(user_data['created_at'])
        if isinstance(user_data.get('magic_link_expiry'), str):
            user_data['magic_link_expiry'] = datetime.fromisoformat(user_data['magic_link_expiry'])
    return user_data

async def analyze_resume_with_ai(resume_text: str, role_target: Optional[str] = None) -> dict:
    """Analyze resume using Gemini 3 Flash"""
    try:
        api_key = os.environ['EMERGENT_LLM_KEY']
        
        chat = LlmChat(
            api_key=api_key,
            session_id=str(uuid.uuid4()),
            system_message="You are an expert ATS resume analyzer. Provide concise, actionable feedback."
        )
        chat.with_model("gemini", "gemini-3-flash-preview")
        
        role_context = f" for a {role_target} role" if role_target else ""
        
        prompt = f"""Analyze this resume{role_context} and provide a structured analysis in JSON format:

{resume_text}

Provide your analysis in this exact JSON structure:
{{
  "overall_score": <number 0-100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "ats_issues": ["issue 1", "issue 2"],
  "improved_bullets": [
    {{"original": "weak bullet", "improved": "stronger ATS-optimized bullet"}},
    {{"original": "weak bullet", "improved": "stronger ATS-optimized bullet"}}
  ],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}}

Keep all text concise and professional."""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        import json
        # Remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1]) if len(lines) > 2 else response_text
        response_text = response_text.replace('```json', '').replace('```', '').strip()
        
        analysis = json.loads(response_text)
        return analysis
        
    except Exception as e:
        logger.error(f"AI analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

# Routes
@api_router.post("/auth/magic-link")
async def request_magic_link(request: MagicLinkRequest):
    """Request a magic link for authentication"""
    user_data = await get_user_by_email(request.email)
    
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(seconds=MAGIC_LINK_EXPIRY)
    
    if not user_data:
        # Create new user
        user = User(
            email=request.email,
            magic_link_token=token,
            magic_link_expiry=expiry
        )
        doc = user.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['magic_link_expiry'] = doc['magic_link_expiry'].isoformat()
        await db.users.insert_one(doc)
    else:
        # Update existing user with new token
        await db.users.update_one(
            {"email": request.email},
            {"$set": {
                "magic_link_token": token,
                "magic_link_expiry": expiry.isoformat()
            }}
        )
    
    # In production, send email with token
    # For now, return token directly (DEV ONLY)
    return {
        "message": "Magic link sent",
        "token": token,  # Remove this in production
        "dev_note": "In production, this token would be sent via email"
    }

@api_router.post("/auth/verify", response_model=AuthResponse)
async def verify_magic_link(request: MagicLinkVerify):
    """Verify magic link token"""
    user_data = await db.users.find_one({"magic_link_token": request.token}, {"_id": 0})
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Parse datetime if string
    if isinstance(user_data.get('magic_link_expiry'), str):
        expiry = datetime.fromisoformat(user_data['magic_link_expiry'])
    else:
        expiry = user_data.get('magic_link_expiry')
    
    if not expiry or datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=401, detail="Token expired")
    
    # Clear token after use
    await db.users.update_one(
        {"magic_link_token": request.token},
        {"$set": {"magic_link_token": None, "magic_link_expiry": None}}
    )
    
    return AuthResponse(
        user_id=user_data['id'],
        email=user_data['email'],
        usage_count=user_data['usage_count'],
        usage_limit=FREE_TIER_LIMIT
    )

@api_router.get("/user/{user_id}", response_model=AuthResponse)
async def get_user_info(user_id: str):
    """Get user information"""
    user_data = await get_user_by_id(user_id)
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return AuthResponse(
        user_id=user_data['id'],
        email=user_data['email'],
        usage_count=user_data['usage_count'],
        usage_limit=FREE_TIER_LIMIT
    )

@api_router.post("/analyze/text")
async def analyze_resume_text(request: ResumeTextRequest, user_id: str):
    """Analyze resume from pasted text"""
    user_data = await get_user_by_id(user_id)
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data['usage_count'] >= FREE_TIER_LIMIT:
        raise HTTPException(status_code=403, detail="Usage limit reached. Please upgrade.")
    
    # Analyze resume
    analysis_result = await analyze_resume_with_ai(request.resume_text, request.role_target)
    
    # Save analysis
    analysis = ResumeAnalysis(
        user_id=user_id,
        resume_text=request.resume_text[:500],  # Store only first 500 chars
        analysis_result=analysis_result
    )
    
    doc = analysis.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.analyses.insert_one(doc)
    
    # Increment usage count
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"usage_count": 1}}
    )
    
    return {
        "analysis_id": analysis.id,
        "analysis": analysis_result,
        "remaining_uses": FREE_TIER_LIMIT - user_data['usage_count'] - 1
    }

@api_router.post("/analyze/pdf")
async def analyze_resume_pdf(file: UploadFile = File(...), user_id: str = "", role_target: Optional[str] = None):
    """Analyze resume from uploaded PDF"""
    user_data = await get_user_by_id(user_id)
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data['usage_count'] >= FREE_TIER_LIMIT:
        raise HTTPException(status_code=403, detail="Usage limit reached. Please upgrade.")
    
    # Extract text from PDF
    try:
        contents = await file.read()
        pdf = PdfReader(io.BytesIO(contents))
        resume_text = ""
        for page in pdf.pages:
            resume_text += page.extract_text()
        
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    except Exception as e:
        logger.error(f"PDF parsing error: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid PDF file")
    
    # Analyze resume
    analysis_result = await analyze_resume_with_ai(resume_text, role_target)
    
    # Save analysis
    analysis = ResumeAnalysis(
        user_id=user_id,
        resume_text=resume_text[:500],
        analysis_result=analysis_result
    )
    
    doc = analysis.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.analyses.insert_one(doc)
    
    # Increment usage count
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"usage_count": 1}}
    )
    
    return {
        "analysis_id": analysis.id,
        "analysis": analysis_result,
        "remaining_uses": FREE_TIER_LIMIT - user_data['usage_count'] - 1
    }

@api_router.get("/analyses/{user_id}")
async def get_user_analyses(user_id: str):
    """Get all analyses for a user"""
    analyses = await db.analyses.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for analysis in analyses:
        if isinstance(analysis.get('created_at'), str):
            analysis['created_at'] = datetime.fromisoformat(analysis['created_at'])
    
    return {"analyses": analyses}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()