import asyncio
import json
import logging
import time
from fastapi import APIRouter
from api.config import settings
from api.models import (
    SearchRequest,
    SearchResponse,
    PlatformProduct,
    PriceHistoryResponse,
    PriceHistoryItem,
    TrackedProductsResponse,
    TrackedProductItem,
)
from api.matching import group_products
from api.geo import geocode_pin
from scraper.blinkit import BlinkitScraper
from scraper.zepto import ZeptoScraper
from scraper.instamart import InstamartScraper
from scraper.flipkart import FlipkartScraper
from scraper.bigbasket import BigBasketScraper
from db.repository import (
    save_search_record,
    save_product_and_snapshot,
    get_price_history_by_normalized_name,
    get_all_tracked_products,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["search"])

SCRAPERS = {
    "blinkit": BlinkitScraper(),
    "zepto": ZeptoScraper(),
    "instamart": InstamartScraper(),
    "flipkart": FlipkartScraper(),
    "bigbasket": BigBasketScraper(),
}

SEARCH_CACHE: dict[str, tuple[float, SearchResponse]] = {}


async def close_all_scrapers() -> None:
    for scraper in SCRAPERS.values():
        await scraper.close_context()


async def run_single_scraper(
    scraper_name: str, query: str, pin: str, lat: float | None, lon: float | None
) -> list[PlatformProduct]:
    scraper = SCRAPERS.get(scraper_name)
    if not scraper:
        return []

    try:
        results = await asyncio.wait_for(
            scraper.search(query=query, pin=pin, lat=lat, lon=lon),
            timeout=settings.scraper_timeout_seconds,
        )
        return results
    except asyncio.TimeoutError:
        logger.warning(f"Scraper {scraper_name} timed out after {settings.scraper_timeout_seconds}s")
        return []
    except Exception as exc:
        logger.error(f"Scraper {scraper_name} failed: {exc}")
        return []


async def resolve_lat_lon(pin: str, lat: float | None, lon: float | None) -> tuple[float, float]:
    place = await geocode_pin(pin)
    if not place:
        return (lat or settings.default_lat, lon or settings.default_lon)
    if lat is not None and lon is not None and abs(lat - place["lat"]) < 0.5 and abs(lon - place["lon"]) < 0.5:
        return (lat, lon)
    return (place["lat"], place["lon"])


def _is_platform_enabled(platform: str) -> bool:
    mapping = {
        "blinkit": settings.enable_blinkit,
        "zepto": settings.enable_zepto,
        "instamart": settings.enable_instamart,
        "flipkart": settings.enable_flipkart,
        "bigbasket": settings.enable_bigbasket,
    }
    return mapping.get(platform, True)


async def execute_concurrent_search(
    query: str,
    pin: str,
    lat: float | None = None,
    lon: float | None = None,
    platforms: list[str] | None = None,
) -> SearchResponse:
    lat, lon = await resolve_lat_lon(pin, lat, lon)
    normalized_query = query.strip().lower()
    cache_key = f"{normalized_query}:{pin}:{lat}:{lon}:{sorted(platforms) if platforms else 'all'}"

    now = time.time()
    if cache_key in SEARCH_CACHE:
        cached_time, cached_response = SEARCH_CACHE[cache_key]
        if now - cached_time < settings.cache_ttl_seconds:
            return SearchResponse(
                query=cached_response.query,
                pin=cached_response.pin,
                total_groups=cached_response.total_groups,
                cached=True,
                results=cached_response.results,
            )

    selected_platforms = (
        [p for p in platforms if p in SCRAPERS and _is_platform_enabled(p)] if platforms else [p for p in SCRAPERS.keys() if _is_platform_enabled(p)]
    )

    tasks = [
        run_single_scraper(platform, query, pin, lat, lon)
        for platform in selected_platforms
    ]

    scraped_batches = await asyncio.gather(*tasks, return_exceptions=True)

    all_products: list[PlatformProduct] = []
    for batch in scraped_batches:
        if isinstance(batch, list):
            all_products.extend(batch)

    grouped_results = group_products(all_products)

    for product in all_products:
        await save_product_and_snapshot(
            normalized_name=product.name,
            platform=product.platform,
            name=product.name,
            price=product.price,
            pin=pin,
            quantity=product.quantity,
            image_url=product.image_url,
            product_url=product.product_url,
            mrp=product.mrp,
            in_stock=product.in_stock,
        )

    response = SearchResponse(
        query=query,
        pin=pin,
        total_groups=len(grouped_results),
        cached=False,
        results=grouped_results,
    )

    SEARCH_CACHE[cache_key] = (now, response)

    serialized_results = json.dumps([g.model_dump() for g in grouped_results])
    await save_search_record(query=query, pin=pin, results_json=serialized_results)

    return response


@router.post("/search", response_model=SearchResponse)
async def search_products(request: SearchRequest) -> SearchResponse:
    return await execute_concurrent_search(
        query=request.query,
        pin=request.pin,
        lat=request.lat,
        lon=request.lon,
        platforms=request.platforms,
    )


@router.get("/history", response_model=PriceHistoryResponse)
async def get_product_history(name: str) -> PriceHistoryResponse:
    history_records = await get_price_history_by_normalized_name(name)
    items = [
        PriceHistoryItem(
            scraped_at=record["scraped_at"],
            platform=record["platform"],
            product_name=record["product_name"],
            price=record["price"],
            mrp=record["mrp"],
            in_stock=record["in_stock"],
            pin=record["pin"],
            logged_in=record["logged_in"],
        )
        for record in history_records
    ]
    return PriceHistoryResponse(normalized_name=name, history=items)


@router.get("/history/products", response_model=TrackedProductsResponse)
async def get_tracked_products() -> TrackedProductsResponse:
    products = await get_all_tracked_products()
    return TrackedProductsResponse(
        products=[
            TrackedProductItem(
                id=p["id"],
                normalized_name=p["normalized_name"],
                platform=p["platform"],
                name=p["name"],
                quantity=p["quantity"],
                brand=p["brand"],
                image_url=p["image_url"],
                product_url=p["product_url"],
                in_stock=p["in_stock"],
                updated_at=p["updated_at"],
            )
            for p in products
        ]
    )
