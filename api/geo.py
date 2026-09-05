import asyncio
import json
import logging
import httpx
from api.config import settings

logger = logging.getLogger(__name__)

NOMINATIM = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "quick-commerce-compare/1.0 (self-hosted personal tool)"}
CACHE_FILE = settings.data_dir / "geocache.json"
_lock = asyncio.Lock()


def _load() -> dict:
    try:
        return json.loads(CACHE_FILE.read_text())
    except Exception:
        return {}


_cache: dict = _load()


def _save() -> None:
    try:
        CACHE_FILE.write_text(json.dumps(_cache))
    except Exception as exc:
        logger.warning(f"geocache write failed: {exc}")


def _place(address: dict) -> dict:
    return {
        "city": address.get("city") or address.get("town") or address.get("county") or address.get("state_district") or "",
        "state": address.get("state") or "",
        "postcode": address.get("postcode") or "",
    }


async def geocode_pin(pin: str) -> dict | None:
    pin = (pin or "").strip()
    if not pin.isdigit() or len(pin) != 6:
        return None
    if pin in _cache:
        return _cache[pin]
    async with _lock:
        if pin in _cache:
            return _cache[pin]
        try:
            async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
                r = await client.get(
                    f"{NOMINATIM}/search",
                    params={"postalcode": pin, "country": "India", "format": "jsonv2", "addressdetails": 1, "limit": 1},
                )
                hits = r.json() if r.status_code == 200 else []
                if not hits:
                    po = await client.get(f"https://api.postalpincode.in/pincode/{pin}")
                    offices = (po.json()[0].get("PostOffice") or []) if po.status_code == 200 else []
                    if offices:
                        q = f"{offices[0].get('Name')}, {offices[0].get('District')}, {offices[0].get('State')}, India"
                        r = await client.get(
                            f"{NOMINATIM}/search",
                            params={"q": q, "format": "jsonv2", "addressdetails": 1, "limit": 1},
                        )
                        hits = r.json() if r.status_code == 200 else []
                if not hits:
                    return None
                hit = hits[0]
                place = _place(hit.get("address", {}))
                place.update({"lat": float(hit["lat"]), "lon": float(hit["lon"]), "postcode": pin})
                _cache[pin] = place
                _save()
                return place
        except Exception as exc:
            logger.warning(f"geocode failed for {pin}: {exc}")
            return None


async def reverse_geocode(lat: float, lon: float) -> dict | None:
    key = f"{lat:.4f},{lon:.4f}"
    if key in _cache:
        return _cache[key]
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
            r = await client.get(
                f"{NOMINATIM}/reverse",
                params={"lat": lat, "lon": lon, "format": "jsonv2", "addressdetails": 1, "zoom": 18},
            )
            if r.status_code != 200:
                return None
            place = _place(r.json().get("address", {}))
            place.update({"lat": lat, "lon": lon})
            async with _lock:
                _cache[key] = place
                _save()
            return place
    except Exception as exc:
        logger.warning(f"reverse geocode failed for {lat},{lon}: {exc}")
        return None


if __name__ == "__main__":
    async def demo():
        p = await geocode_pin("800023")
        assert p and abs(p["lat"] - 25.61) < 0.1 and "Patna" in p["city"], p
        d = await geocode_pin("110001")
        assert d and abs(d["lat"] - 28.63) < 0.1, d
        assert await geocode_pin("abc") is None
        r = await reverse_geocode(25.6122, 85.1129)
        assert r and r["postcode"].startswith("800"), r
        print("ok", p, d, r)

    asyncio.run(demo())
