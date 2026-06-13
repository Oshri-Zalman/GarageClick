"""FastAPI application factory + entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    admin, auth, catalog, customers, mechanics, parts, staff, tickets, vehicles,
)


def create_app() -> FastAPI:
    app = FastAPI(title="GarageClick API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok", "service": "garageclick-backend"}

    app.include_router(auth.router)
    app.include_router(customers.router)
    app.include_router(vehicles.router)
    app.include_router(tickets.router)
    app.include_router(parts.router)
    app.include_router(admin.router)
    app.include_router(mechanics.router)
    app.include_router(staff.router)
    app.include_router(catalog.router)

    return app


app = create_app()
