import base64
import logging
import httpx
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.bigbasket.com/listing-svc/v2/products"


def _money(val) -> float | None:
    try:
        return float(str(val).replace(",", "")) if val not in (None, "") else None
    except ValueError:
        return None


def parse_products(payload: dict) -> list[PlatformProduct]:
    products: list[PlatformProduct] = []
    for tab in payload.get("tabs") or []:
        for item in (tab.get("product_info") or {}).get("products") or []:
            desc = item.get("desc")
            brand = (item.get("brand") or {}).get("name") or ""
            discount = ((item.get("pricing") or {}).get("discount") or {})
            price = _money((discount.get("prim_price") or {}).get("sp"))
            if not desc or price is None:
                continue
            name = desc if not brand or desc.lower().startswith(brand.lower()) else f"{brand} {desc}"
            images = item.get("images") or []
            url = item.get("absolute_url")
            products.append(
                PlatformProduct(
                    platform="bigbasket",
                    name=name.strip(),
                    price=price,
                    mrp=_money(discount.get("mrp")),
                    quantity=item.get("w") or item.get("pack_desc"),
                    in_stock=(item.get("availability") or {}).get("avail_status", "001") == "001",
                    product_url=f"https://www.bigbasket.com{url}" if url else None,
                    image_url=(images[0].get("m") or images[0].get("s")) if images and isinstance(images[0], dict) else None,
                    eta="15-30 mins",
                )
            )
    return products


class BigBasketScraper(BaseScraper):
    def __init__(self):
        super().__init__("bigbasket")

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        if lat is None or lon is None:
            return []
        cookies = {
            "_bb_lat_long": base64.b64encode(f"{lat}|{lon}".encode()).decode(),
            "_bb_vid": base64.b64encode(b"1").decode(),
        }
        params = {"type": "ps", "slug": query.strip().lower().replace(" ", "-"), "page": 1}
        try:
            async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "Mozilla/5.0"}) as client:
                r = await client.get(SEARCH_URL, params=params, cookies=cookies)
            if r.status_code == 204:
                return []
            if r.status_code == 303:
                logger.info(f"BigBasket not serviceable at {lat},{lon}")
                return []
            r.raise_for_status()
            return parse_products(r.json())
        except Exception as exc:
            logger.error(f"BigBasket search failed: {exc}")
            return []
