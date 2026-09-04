from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    auth,
    branches,
    cities,
    collections,
    customers,
    dispatches,
    inventory,
    logs,
    payment_methods,
    products,
    purchase_history,
    recommendations,
    reservations,
    sales,
    seasons,
    suppliers,
    team,
)

settings = get_settings()

app = FastAPI(
    title="API Ropa Unisex",
    description="Backend unico para web (Angular) y mobile (Flutter)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "API Ropa Unisex", "docs": "/docs", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "ok"}


for router in (
    auth.router,
    products.router,
    inventory.router,
    dispatches.router,
    team.router,
    cities.router,
    seasons.router,
    suppliers.router,
    collections.router,
    branches.router,
    customers.router,
    payment_methods.router,
    recommendations.router,
    sales.router,
    reservations.router,
    purchase_history.router,
    logs.router,
):
    app.include_router(router)
