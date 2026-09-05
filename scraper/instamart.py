import json
import logging
from urllib.parse import quote, quote_plus
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)

IMG_PREFIX = "https://instamart-media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,h_272,w_252/"


def _money(val) -> float | None:
    if isinstance(val, dict):
        units = val.get("units")
        return None if units in (None, "") else float(units) + float(val.get("nanos") or 0) / 1e9
    return float(val) if isinstance(val, (int, float, str)) and str(val).strip() else None


def parse_search(payload: dict) -> list[PlatformProduct]:
    products: list[PlatformProduct] = []
    for card in (payload.get("data") or {}).get("cards") or []:
        inner = ((card.get("card") or {}).get("card") or {})
        items = ((inner.get("gridElements") or {}).get("infoWithStyle") or {}).get("items") or []
        for item in items:
            product_id = item.get("productId")
            for var in item.get("variations") or []:
                price_info = var.get("price") or {}
                name = var.get("displayName") or item.get("displayName")
                price = _money(price_info.get("offerPrice")) or _money(price_info.get("mrp"))
                if not name or price is None:
                    continue
                images = var.get("imageIds") or []
                in_stock = bool(item.get("inStock", True)) and bool(item.get("isAvail", True)) and bool((var.get("inventory") or {}).get("inStock", True))
                products.append(
                    PlatformProduct(
                        platform="instamart",
                        name=str(name).strip(),
                        price=price,
                        mrp=_money(price_info.get("mrp")),
                        quantity=var.get("quantityDescription"),
                        in_stock=in_stock,
                        product_url=f"https://www.swiggy.com/instamart/item/{product_id}" if product_id else None,
                        image_url=IMG_PREFIX + images[0] if images else None,
                        eta="10-15 mins",
                    )
                )
    return products


class InstamartScraper(BaseScraper):
    def __init__(self):
        super().__init__("instamart")

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        if lat is None or lon is None:
            return []
        async with self.lock:
            context = await self.get_context()
            loc = json.dumps({"address": "", "lat": lat, "lng": lon, "id": "", "annotation": "", "name": ""})
            await context.clear_cookies()
            await context.add_cookies([
                {"name": "userLocation", "value": quote(loc), "domain": ".swiggy.com", "path": "/"},
                {"name": "lat", "value": str(lat), "domain": ".swiggy.com", "path": "/"},
                {"name": "lng", "value": str(lon), "domain": ".swiggy.com", "path": "/"},
            ])
            page = await context.new_page()
            payloads: list[dict] = []

            async def on_response(response):
                if "/api/instamart/search" in response.url and response.status == 200:
                    try:
                        body = await response.json()
                        if isinstance(body, dict) and body.get("data"):
                            payloads.append(body)
                    except Exception:
                        pass

            page.on("response", on_response)
            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort() if route.request.resource_type in ["image", "media", "font"] else route.continue_(),
                )
                async with page.expect_response(lambda r: "/api/instamart/search" in r.url and r.status == 200, timeout=35000):
                    await page.goto(
                        f"https://www.swiggy.com/instamart/search?custom_back=true&query={quote_plus(query)}",
                        wait_until="commit",
                        timeout=25000,
                    )
                await page.wait_for_timeout(500)
            except Exception as exc:
                logger.error(f"Instamart search failed: {exc}")
            finally:
                page.remove_listener("response", on_response)
                await page.close()
            products: list[PlatformProduct] = []
            for payload in payloads:
                products.extend(parse_search(payload))
            return products
