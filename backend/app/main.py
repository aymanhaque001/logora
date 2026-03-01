from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import users, topics, arguments
from app.config import settings

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Logora API",
    description="Fact-based structured debate platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(topics.router)
app.include_router(arguments.router)


@app.get("/api/health")
def health():
    from app.services.ai_service import get_status
    return {"status": "ok", "version": "0.1.0", "ai": get_status()}
