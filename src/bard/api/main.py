"""FastAPI application for Bard audiobook system."""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bard.api.routes import agent_router, playback_router, qa_router, transcribe_router
from bard.config import get_settings
from bard.database import init_db

app = FastAPI(
    title="Bard",
    description="Interactive Audiobook System with AI Q&A",
    version="0.1.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agent_router)
app.include_router(playback_router)
app.include_router(qa_router)
app.include_router(transcribe_router)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize database on startup."""
    init_db()


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "bard"}


@app.get("/")
async def root() -> dict:
    """Root endpoint with API info."""
    return {
        "name": "Bard",
        "description": "Interactive Audiobook System",
        "version": "0.1.0",
        "docs": "/docs",
    }


def run() -> None:
    """Entry point for bard-serve command."""
    settings = get_settings()
    uvicorn.run(
        "bard.api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    run()
