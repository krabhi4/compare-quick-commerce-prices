import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from api.config import settings
from api.models import HealthResponse, LocationUpdateRequest, LocationResponse
from api.search import router as search_router, close_all_scrapers
from api.auth import router as auth_router
from api.alerts import router as alerts_router, run_alerts_check_cycle
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


PIN_COORDS: dict[str, tuple[float, float]] = {
    "11": (28.6139, 77.2090),
    "12": (28.46, 77.06),
    "14": (31.0, 75.0),
    "30": (27.0, 74.0),
    "40": (19.0760, 72.8777),
    "50": (17.3850, 78.4867),
    "56": (12.9716, 77.5946),
    "60": (13.0827, 80.2707),
    "70": (22.5726, 88.3639),
    "80": (25.6162, 85.0926),
    "82": (25.6162, 85.0926),
    "83": (23.3441, 85.3096),
    "84": (25.5941, 85.1376),
}


def coords_for_pin(pin: str) -> tuple[float, float] | None:
    if not pin or len(pin) < 2:
        return None
    prefix = pin[:2]
    return PIN_COORDS.get(prefix)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok", version=settings.app_version)


@app.post("/location", response_model=LocationResponse)
async def set_location(update: LocationUpdateRequest) -> LocationResponse:
    current_location["pin"] = update.pin
    if update.lat is not None:
        current_location["lat"] = update.lat
    else:
        inferred = coords_for_pin(update.pin)
        if inferred:
            current_location["lat"], current_location["lon"] = inferred
    if update.lon is not None:
        current_location["lon"] = update.lon
    elif update.lat is None:
        inferred = coords_for_pin(update.pin)
        if inferred:
            current_location["lat"], current_location["lon"] = inferred
    persist_location()
    return LocationResponse(
        pin=current_location["pin"],
        lat=current_location["lat"],
        lon=current_location["lon"],
    )


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
