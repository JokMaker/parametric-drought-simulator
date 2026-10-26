"""The API: one FastAPI app assembled from three routers (index, farmers, messaging)."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .routers import farmers, index, messaging

app = FastAPI(
    title="Drought Index Simulator API",
    description="Parametric drought-index insurance simulator, Season A maize, Eastern Rwanda.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(index.router)
app.include_router(farmers.router)
app.include_router(messaging.router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")
