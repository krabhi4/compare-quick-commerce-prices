import logging
import time
from urllib.parse import quote_plus
import httpx
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
HEADERS = {"X-User-Agent": f"{UA} FKUA/website/42/website/Desktop", "User-Agent": UA, "Origin": "https://www.flipkart.com"}


def _image(images: list) -> str | None:
    if not images or not isinstance(images[0], dict):
        return None
    url = images[0].get("url") or ""
    return url.replace("{@width}", "300").replace("{@height}", "300").replace("{@quality}", "70") or None


def parse_page(payload: dict) -> list[PlatformProduct]:
    resp = payload.get("RESPONSE") or {}
    if (((resp.get("pageMeta") or {}).get("redirectionObject") or {}).get("statusCode")) == 302:
        return []
    products: list[PlatformProduct] = []
    for slot in resp.get("slots") or []:
        for item in (((slot.get("widget") or {}).get("data") or {}).get("products") or []):
            value = (item.get("productInfo") or {}).get("value") or {}
            titles = value.get("titles") or {}
            pricing = value.get("pricing") or {}
            price = (pricing.get("finalPrice") or {}).get("value")
            if not titles.get("title") or price is None:
                continue
            mrp = (pricing.get("mrp") or {}).get("value")
            base_url = value.get("baseUrl")
            products.append(
                PlatformProduct(
                    platform="flipkart",
                    name=titles["title"].strip(),
                    price=float(price),
                    mrp=float(mrp) if mrp else None,
                    quantity=titles.get("subtitle"),
                    in_stock=(value.get("availability") or {}).get("displayState", "IN_STOCK") == "IN_STOCK",
                    product_url=f"https://www.flipkart.com{base_url}" if base_url else None,
                    image_url=_image((value.get("media") or {}).get("images") or []),
                    eta="10-15 mins",
                )
            )
    return products


class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__("flipkart")
        self._client: httpx.AsyncClient | None = None
        self._dc = "1"
        self._located: tuple[str, float, float] | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(headers=HEADERS, timeout=30)
            self._client.cookies.set("T", f"TI{int(time.time() * 1000)}" + "0" * 52, domain=".flipkart.com")
        return self._client

    async def _post(self, path: str, body: dict) -> dict:
        client = self._get_client()
        for _ in range(2):
            r = await client.post(f"https://{self._dc}.rome.api.flipkart.com/api/4/{path}", json=body)
            data = r.json() if r.content else {}
            if r.status_code == 406 and data.get("ERROR_CODE") == 2000:
                self._dc = data["META_INFO"]["dcInfo"]["id"]
                continue
            r.raise_for_status()
            return data
        raise RuntimeError("Flipkart data-centre redirect loop")

    async def _ensure_location(self, pin: str, lat: float, lon: float) -> None:
        if self._located == (pin, lat, lon):
            return
        await self._post(
            "location/update",
            {
                "geoLocation": {"latitude": lat, "longitude": lon},
                "addressInfo": {"addressLine1": pin, "pincode": pin},
                "marketplace": "HYPERLOCAL",
            },
        )
        self._located = (pin, lat, lon)

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        if lat is None or lon is None:
            return []
        async with self.lock:
            try:
                await self._ensure_location(pin, lat, lon)
                payload = await self._post(
                    "page/fetch",
                    {
                        "pageUri": f"/search?q={quote_plus(query.strip())}&marketplace=HYPERLOCAL",
                        "pageContext": {"fetchSeoData": True, "paginatedFetch": False, "pageNumber": 1},
                        "requestContext": {"type": "BROWSE_PAGE", "ssid": "", "sqid": ""},
                    },
                )
                return parse_page(payload)
            except Exception as exc:
                self._located = None
                logger.error(f"Flipkart search failed: {exc}")
                return []

    async def close_context(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
        await super().close_context()
