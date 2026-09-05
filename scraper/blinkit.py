import asyncio
import logging
from curl_cffi import requests
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)

SEARCH_URL = "https://blinkit.com/v1/layout/search"


def _text(val) -> str | None:
    if isinstance(val, dict):
        val = val.get("text")
    return str(val).strip() if val else None


def parse_snippets(snippets: list[dict]) -> list[PlatformProduct]:
    products: list[PlatformProduct] = []
    for snippet in snippets:
        if snippet.get("widget_type") != "product_card_snippet_type_2":
            continue
        data = snippet.get("data") or {}
        item = ((data.get("atc_action") or {}).get("add_to_cart") or {}).get("cart_item") or {}
        name = item.get("product_name") or _text(data.get("name"))
        price = item.get("price")
        if not name or price is None:
            continue
        product_id = item.get("product_id") or data.get("product_id")
        inventory = item.get("inventory", data.get("inventory", 1)) or 0
        products.append(
            PlatformProduct(
                platform="blinkit",
                name=name,
                price=float(price),
                mrp=float(item["mrp"]) if item.get("mrp") else None,
                quantity=item.get("unit") or _text(data.get("variant")),
                in_stock=inventory > 0 and not data.get("is_sold_out", False),
                product_url=f"https://blinkit.com/prn/{product_id}" if product_id else None,
                image_url=item.get("image_url") or (data.get("image") or {}).get("url"),
                eta=_text((data.get("eta_tag") or {}).get("title")),
            )
        )
    return products


class BlinkitScraper(BaseScraper):
    def __init__(self):
        super().__init__("blinkit")

    def _fetch(self, query: str, lat: float, lon: float, pages: int = 2) -> list[dict]:
        headers = {"lat": str(lat), "lon": str(lon), "app_client": "consumer_web"}
        url, params = SEARCH_URL, {"q": query, "search_type": "type_to_search"}
        snippets: list[dict] = []
        for _ in range(pages):
            r = requests.post(url, params=params, headers=headers, impersonate="chrome", timeout=20)
            if r.status_code == 400 and "serviceable" in r.text:
                logger.info(f"Blinkit not serviceable at {lat},{lon}")
                break
            r.raise_for_status()
            response = r.json().get("response") or {}
            snippets.extend(response.get("snippets") or [])
            next_url = (response.get("pagination") or {}).get("next_url")
            if not next_url:
                break
            url, params = "https://blinkit.com" + next_url, None
        return snippets

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        if lat is None or lon is None:
            return []
        try:
            snippets = await asyncio.to_thread(self._fetch, query, lat, lon)
        except Exception as exc:
            logger.error(f"Blinkit search failed: {exc}")
            return []
        return parse_snippets(snippets)
