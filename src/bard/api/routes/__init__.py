"""API routes for Bard."""

from bard.api.routes.playback import router as playback_router
from bard.api.routes.qa import router as qa_router

__all__ = ["playback_router", "qa_router"]

