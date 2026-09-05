import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.config import settings
from api.models import HealthResponse, LocationUpdateRequest, LocationResponse
from api.search import router as search_router, close_all_scrapers
from api.auth import router as auth_router
from api.alerts import router as alerts_router, run_alerts_check_cycle
from api.geo import geocode_pin, reverse_geocode
from db.repository import init_database

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    alert_task = asyncio.create_task(run_alerts_check_cycle())
    yield
    alert_task.cancel()
    try:
        await alert_task
    except asyncio.CancelledError:
        pass
    await close_all_scrapers()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(auth_router)
app.include_router(alerts_router)

location_file = settings.data_dir / "location.json"

def load_persisted_location() -> dict:
    try:
        if location_file.exists():
            data = json.loads(location_file.read_text())
            return {
                "pin": data.get("pin", settings.default_pin),
                "lat": data.get("lat", settings.default_lat),
                "lon": data.get("lon", settings.default_lon),
            }
    except Exception:
        pass
    return {
        "pin": settings.default_pin,
        "lat": settings.default_lat,
        "lon": settings.default_lon,
    }

current_location = load_persisted_location()

def persist_location() -> None:
    try:
        location_file.write_text(json.dumps(current_location))
    except Exception as exc:
        logger.warning(f"Failed to persist location: {exc}")


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", version=settings.app_version)


@app.post("/location", response_model=LocationResponse)
async def set_location(update: LocationUpdateRequest) -> LocationResponse:
    if update.pin:
        place = await geocode_pin(update.pin)
        if not place:
            raise HTTPException(status_code=400, detail=f"Could not locate pincode {update.pin}")
        near = update.lat is not None and update.lon is not None and abs(update.lat - place["lat"]) < 0.5 and abs(update.lon - place["lon"]) < 0.5
        current_location.update(pin=update.pin, lat=update.lat if near else place["lat"], lon=update.lon if near else place["lon"])
    elif update.lat is not None and update.lon is not None:
        place = await reverse_geocode(update.lat, update.lon)
        pin = (place or {}).get("postcode", "")
        if not (pin.isdigit() and len(pin) == 6):
            raise HTTPException(status_code=400, detail="Could not resolve a pincode for this position")
        current_location.update(pin=pin, lat=update.lat, lon=update.lon)
    else:
        raise HTTPException(status_code=400, detail="Provide a pincode or coordinates")
    persist_location()
    return LocationResponse(**current_location)


@app.get("/location", response_model=LocationResponse)
async def get_location() -> LocationResponse:
    return LocationResponse(
        pin=current_location["pin"],
        lat=current_location["lat"],
        lon=current_location["lon"],
    )


frontend_dist_dir = Path("frontend/dist")
if frontend_dist_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist_dir / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = frontend_dist_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index_path = frontend_dist_dir / "index.html"
        if index_path.is_file():
            return FileResponse(index_path)
        return {"error": "Frontend not built yet"}
