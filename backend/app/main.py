"""The API: one FastAPI app assembled from four routers (index, farmers, policies, messaging)."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .routers import farmers, index, messaging, policies

app = FastAPI(
    title="Drought Index Simulator API",
    version="1.0.0",
    description=(
        "Parametric drought-index insurance for Season A maize in Eastern Rwanda's seven districts. "
        "Satellite rainfall (CHIRPS) and crop greenness (MODIS NDVI) give a predicted yield change; "
        "a payout starts at -2% and is full at -22%.\n\n"
        "Dashboard: [rdi-maize-insurance.vercel.app](https://rdi-maize-insurance.vercel.app) · "
        "Source: [GitHub](https://github.com/JokMaker/parametric-drought-simulator) · "
        "USSD: `*384*44698#` (Africa's Talking sandbox)"
    ),
    openapi_tags=[
        {"name": "Index and payouts", "description": "The model, its payouts and how well they match real harvests"},
        {"name": "Season monitor", "description": "The Season A window in progress"},
        {"name": "Policies", "description": "Farmers who signed up over USSD (phone numbers masked)"},
        {"name": "Loss reports", "description": "Crop losses reported by farmers, which feed field checks"},
        {"name": "SMS and USSD", "description": "The farmer's phone channel through Africa's Talking"},
        {"name": "Map", "description": "District shapes for the dashboard map"},
        {"name": "Service", "description": "Health check for uptime monitoring"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(index.router)
app.include_router(farmers.router)
app.include_router(policies.router)
app.include_router(messaging.router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/docs")
