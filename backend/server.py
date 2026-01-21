from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient




import os
import logging
import asyncio
import json
import re
import io
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
import secrets
from pypdf import PdfReader

from groq import Groq

# -------------------------------------------------
# ENV
# -------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Validate required environment variables
required_env_vars = ["MONGO_URL", "DB_NAME", "GROQ_API_KEY", "MAGIC_LINK_SECRET"]
missing_vars = [var for var in required_env_vars if not os.environ.get(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}. Please check your .env file.")

# -------------------------------------------------
# DATABASE
# -------------------------------------------------
try:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
except Exception as e:
    raise ValueError(f"Failed to initialize database connection: {str(e)}")

# -------------------------------------------------
# APP
# -------------------------------------------------
app = FastAPI(
    title="ResumeAI API",
    description="AI-powered resume analysis and optimization",
    version="1.0.0"
)

# ✅ CORS MIDDLEWARE - MUST BE FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://resume-ai-frontend-dusky.vercel.app",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# -------------------------------------------------
# LOGGING
# -------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resume-ai")

# -------------------------------------------------
# CONSTANTS
# -------------------------------------------------
FREE_TIER_LIMIT = 3
MAGIC_LINK_EXPIRY = 3600
MAX_RESUME_CHARS = 12000  # token safety for gemini-1.0-pro

# -------------------------------------------------
# MODELS
# -------------------------------------------------
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    usage_count: int = 0
    magic_link_token: Optional[str] = None
    magic_link_expiry: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResumeAnalysis(BaseModel):
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


# -------------------------------------------------
# HELPERS
# -------------------------------------------------
async def get_user_by_email(email: str):
    return await db.users.find_one({"email": email}, {"_id": 0})


async def get_user_by_id(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if user and "_id" in user:
        user["_id"] = str(user["_id"])
    return user


def extract_json(text: str) -> dict:
    """
    Extract valid JSON from AI output.
    Handles cases where extra text appears before/after JSON.
    """
    text = text.strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise ValueError("No JSON object found in response")
        
        json_str = match.group()
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            # Try to find the valid JSON by trimming from the end
            for i in range(len(json_str), 0, -1):
                try:
                    return json.loads(json_str[:i])
                except json.JSONDecodeError:
                    continue
            
            raise ValueError(f"Could not parse JSON: {str(e)}")


def validate_resume_content(text: str) -> tuple[bool, str]:
    """
    Validate if the uploaded text is actually a resume.
    Returns (is_valid, message)
    """
    resume_keywords = {
        'experience', 'education', 'skills', 'work', 'employment', 'job',
        'degree', 'university', 'college', 'certification', 'technical',
        'achievement', 'project', 'responsibility', 'proficiency', 'expert',
        'professional', 'background', 'summary', 'objective', 'core competencies',
        'languages', 'tools', 'technologies', 'qualifications'
    }
    
    text_lower = text.lower()
    
    # Check minimum length
    if len(text.strip()) < 200:
        return False, "Text is too short to be a resume. Please upload a valid resume."
    
    # Check for resume-like keywords
    found_keywords = sum(1 for keyword in resume_keywords if keyword in text_lower)
    
    if found_keywords < 3:
        return False, "This doesn't appear to be a resume. Please upload a valid resume with sections like Experience, Education, or Skills."
    
    # Check if it has some structure (lines, sections)
    lines = text.strip().split('\n')
    if len(lines) < 5:
        return False, "Resume appears incomplete or improperly formatted. Please upload a valid resume."
    
    # Check if mostly empty or just whitespace
    non_empty_lines = [line for line in lines if line.strip()]
    if len(non_empty_lines) < 5:
        return False, "Resume appears to have very little content. Please upload a valid resume with substantial information."
    
    return True, "Valid resume"


# -------------------------------------------------
# AI ANALYSIS (GROQ)
# -------------------------------------------------
async def analyze_resume_with_ai(resume_text: str, role_target: Optional[str]) -> dict:
    # Validate resume content first
    is_valid, message = validate_resume_content(resume_text)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    if not os.environ.get("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    client_groq = Groq(api_key=os.environ["GROQ_API_KEY"])

    # Trim resume to avoid token overflow
    resume_text = resume_text[:MAX_RESUME_CHARS]

    prompt = f"""You are a senior ATS (Applicant Tracking System) evaluator, technical recruiter, and resume strategist with 10+ years of real-world hiring experience across product companies, startups, and MNCs.

Your task is to evaluate the resume below for the given role and provide an HONEST, REALISTIC, and CLEAR analysis.

IMPORTANT MINDSET:
- Do NOT be overly positive.
- Do NOT be harsh without reason.
- Score resumes the way a real recruiter + ATS would.
- Two average resumes must NOT receive the same feedback unless they are truly identical.

TARGET ROLE:
{role_target or "general job applications"}

==============================
SCORING CALIBRATION (CRITICAL)
==============================
Use this scale STRICTLY:

90–100 → Exceptional (top 5%, interview-ready)
80–89  → Very strong (minor improvements needed)
70–79  → Good (solid profile, but gaps exist)
60–69  → Average (skills exist, weak execution)
50–59  → Below average (poor impact, ATS issues)
<50    → Weak (low interview chances)

Do NOT inflate scores.
If impact, metrics, or clarity are missing, the score MUST drop.

==============================
EVALUATION CRITERIA
==============================
Evaluate the resume based on:

1. Skill relevance to the target role
2. Clarity and structure (ATS readability)
3. Use of strong action verbs
4. Presence of measurable impact (numbers, results)
5. Keyword coverage (role-specific)
6. Project depth and technical credibility
7. Formatting consistency and section clarity

==============================
ATS RED FLAGS TO IDENTIFY
==============================
- Generic summaries
- Vague bullets ("worked on", "helped with")
- Missing metrics or outcomes
- Long paragraphs instead of bullets
- Non-standard symbols or formatting
- Missing or weak section headers
- Keyword gaps for the target role

==============================
OUTPUT INSTRUCTIONS (VERY IMPORTANT)
==============================
- Use SIMPLE, PROFESSIONAL English.
- Feedback must be easy to understand for students and professionals.
- Avoid heavy jargon.
- Be direct and practical.
- Return ONLY valid JSON.
- NO markdown, NO explanations, NO extra text.

==============================
RESPONSE JSON FORMAT
==============================
{{
  "overall_score": 0-100 integer,
  "score_verdict": "one short honest sentence explaining the score",
  "summary_insight": "1–2 lines explaining the biggest reason this resume is not scoring higher",

  "strengths": [
    "specific strength tied to actual resume content",
    "specific strength tied to actual resume content",
    "specific strength tied to actual resume content"
  ],

  "weaknesses": [
    "clear weakness with real impact",
    "clear weakness with real impact",
    "clear weakness with real impact"
  ],

  "ats_issues": [
    "specific ATS parsing or formatting issue",
    "specific ATS parsing or formatting issue",
    "specific ATS parsing or formatting issue"
  ],

  "improved_bullets": [
    {{
      "original": "exact original resume bullet",
      "improved": "improved version using strong verbs + realistic metric + clear impact"
    }},
    {{
      "original": "exact original resume bullet",
      "improved": "improved version using strong verbs + realistic metric + clear impact"
    }},
    {{
      "original": "exact original resume bullet",
      "improved": "improved version using strong verbs + realistic metric + clear impact"
    }}
  ],

  "recommendations": [
    "clear and actionable recommendation",
    "clear and actionable recommendation",
    "clear and actionable recommendation"
  ]
}}

==============================
CRITICAL QUALITY RULES
==============================
- Metrics must feel realistic (avoid extreme or fake numbers).
- Improvements must look achievable for THIS resume.
- Feedback must clearly explain HOW to improve, not just WHAT is wrong.
- The analysis must feel like it was written by a human recruiter.

==============================
RESUME TO ANALYZE
==============================
{resume_text}
"""

    last_error = None

    for attempt in range(1, 4):
        try:
            logger.info(f"[AI] Attempt {attempt}")
            response = await asyncio.to_thread(
                client_groq.chat.completions.create,
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2048,
            )

            if not response.choices or not response.choices[0].message:
                raise ValueError("Groq response has no message")

            text = response.choices[0].message.content.strip()
            logger.info(f"[AI] Raw response length: {len(text)}")
            
            result = extract_json(text)
            logger.info("[AI] JSON parsed successfully")
            return result

        except Exception as e:
            last_error = e
            logger.warning(f"[AI] Attempt {attempt} failed: {str(e)}")

    raise HTTPException(
        status_code=500,
        detail=f"AI analysis failed after retries: {str(last_error)}",
    )


# -------------------------------------------------
# AUTH ROUTES
# -------------------------------------------------
@api_router.post("/auth/magic-link")
async def magic_link(req: MagicLinkRequest):
    try:
        token = secrets.token_urlsafe(32)
        expiry = datetime.now(timezone.utc) + timedelta(seconds=MAGIC_LINK_EXPIRY)

        user = await get_user_by_email(req.email)
        if not user:
            await db.users.insert_one(
                User(
                    email=req.email,
                    magic_link_token=token,
                    magic_link_expiry=expiry,
                ).dict()
            )
        else:
            await db.users.update_one(
                {"email": req.email},
                {"$set": {"magic_link_token": token, "magic_link_expiry": expiry}},
            )

        logger.info(f"[AUTH] Magic link generated for {req.email}")
        return {"token": token, "email": req.email, "message": "Magic link generated successfully"}
    except Exception as e:
        logger.error(f"[AUTH] Magic link error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate magic link")


@api_router.post("/auth/verify")
async def verify(req: MagicLinkVerify):
    try:
        user = await db.users.find_one({"magic_link_token": req.token})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check if token has expired
        if user.get("magic_link_expiry"):
            expiry_time = user["magic_link_expiry"]
            
            # Make sure expiry_time is timezone-aware
            if isinstance(expiry_time, str):
                expiry_time = datetime.fromisoformat(expiry_time.replace('Z', '+00:00'))
            elif expiry_time.tzinfo is None:
                expiry_time = expiry_time.replace(tzinfo=timezone.utc)
            
            if datetime.now(timezone.utc) > expiry_time:
                raise HTTPException(status_code=401, detail="Token expired")

        user_id = user.get("id", str(user.get("_id", "")))
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"magic_link_token": None, "magic_link_expiry": None}},
        )

        logger.info(f"[AUTH] User verified: {user['email']}")
        return {
            "user_id": user_id,
            "email": user["email"],
            "usage_count": user.get("usage_count", 0),
            "usage_limit": FREE_TIER_LIMIT,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[AUTH] Verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Verification failed")


# -------------------------------------------------
# ANALYSIS ROUTES
# -------------------------------------------------
@api_router.post("/analyze/text")
async def analyze_text(request: ResumeTextRequest, user_id: str = ""):
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        user = await get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.get("usage_count", 0) >= FREE_TIER_LIMIT:
            raise HTTPException(status_code=403, detail="Usage limit reached")

        analysis = await analyze_resume_with_ai(
            request.resume_text,
            request.role_target,
        )

        # Create and save analysis to database
        resume_analysis = ResumeAnalysis(
            user_id=user_id,
            resume_text=request.resume_text[:500],
            analysis_result=analysis
        )
        await db.analyses.insert_one(resume_analysis.model_dump(mode="json"))

        await db.users.update_one({"id": user_id}, {"$inc": {"usage_count": 1}})

        return {
            "analysis_id": resume_analysis.id,
            "analysis": analysis,
            "remaining_uses": FREE_TIER_LIMIT - user.get("usage_count", 0) - 1,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ANALYZE] Text analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail="Analysis failed")


@api_router.post("/analyze/pdf")
async def analyze_pdf(
    file: UploadFile = File(...),
    user_id: str = "",
    role_target: Optional[str] = None,
):
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        user = await get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.get("usage_count", 0) >= FREE_TIER_LIMIT:
            raise HTTPException(status_code=403, detail="Usage limit reached")

        contents = await file.read()
        pdf = PdfReader(io.BytesIO(contents))
        resume_text = "".join(page.extract_text() or "" for page in pdf.pages)

        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        analysis = await analyze_resume_with_ai(resume_text, role_target)

        # Create and save analysis to database
        resume_analysis = ResumeAnalysis(
            user_id=user_id,
            resume_text=resume_text[:500],
            analysis_result=analysis
        )
        await db.analyses.insert_one(resume_analysis.model_dump(mode="json"))

        await db.users.update_one({"id": user_id}, {"$inc": {"usage_count": 1}})

        return {
            "analysis_id": resume_analysis.id,
            "analysis": analysis,
            "remaining_uses": FREE_TIER_LIMIT - user.get("usage_count", 0) - 1,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ANALYZE] PDF analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail="PDF analysis failed")


# -------------------------------------------------
# USER & ANALYSIS GET ROUTES
# -------------------------------------------------
@api_router.get("/user/{user_id}")
async def get_user(user_id: str):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user["id"],
        "email": user["email"],
        "usage_count": user["usage_count"],
        "usage_limit": FREE_TIER_LIMIT
    }


@api_router.get("/analyses/{user_id}")
async def get_analyses(user_id: str):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    analyses = await db.analyses.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    return {"analyses": analyses}


# -------------------------------------------------
# HEALTH CHECK
# -------------------------------------------------
@app.get("/health")
async def health_check():
    """Health check endpoint for deployment monitoring"""
    try:
        # Check database connection
        await db.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, 500


# -------------------------------------------------
# FINAL SETUP
# -------------------------------------------------
app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown():
    client.close()
