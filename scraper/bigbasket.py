import asyncio
import logging
import re
import urllib.parse
import httpx
import cloudscraper
from api.config import settings
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class BigBasketScraper(BaseScraper):
    def __init__(self):
        super().__init__("bigbasket")
        self.scraper = cloudscraper.create_scraper()

    def _parse_product_item(self, item: dict) -> PlatformProduct | None:
        try:
            name = item.get("desc") or item.get("p_desc") or item.get("name")
            if not name:
                return None

            pricing = item.get("pricing", {}) or item
            discount = pricing.get("discount", {}) or {}
            price = discount.get("prim_price", {}).get("sp") or pricing.get("sp") or item.get("sp")
            mrp = discount.get("mrp") or pricing.get("mrp") or item.get("mrp")

            if price is None:
                return None

            quantity = item.get("w") or item.get("weight") or item.get("pack_desc")

            images = item.get("images") or []
            image_url = None
            if isinstance(images, list) and len(images) > 0:
                first_img = images[0]
                if isinstance(first_img, dict):
                    image_url = first_img.get("s") or first_img.get("m") or first_img.get("l")
                elif isinstance(first_img, str):
                    image_url = first_img
            elif item.get("p_img_url"):
                image_url = item.get("p_img_url")

            product_url = None
            slug = item.get("absolute_url") or item.get("slug")
            if slug:
                product_url = f"https://www.bigbasket.com{slug}" if slug.startswith("/") else f"https://www.bigbasket.com/{slug}"

            in_stock = item.get("in_stock", True)

            return PlatformProduct(
                platform="bigbasket",
                name=name,
                price=float(price),
                mrp=float(mrp) if mrp else None,
                quantity=str(quantity) if quantity else None,
                in_stock=in_stock,
                product_url=product_url,
                image_url=image_url,
                eta="15-30 mins",
            )
        except Exception as exc:
            logger.warning(f"Error parsing BigBasket product: {exc}")
            return None

    async def _search_via_api(self, query: str, lat: float | None = None, lon: float | None = None) -> list[PlatformProduct]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }
        slug = re.sub(r"\s+", "-", query.strip().lower())
        slug = urllib.parse.quote(slug, safe="-")
        lat_val = str(lat or 28.46)
        lon_val = str(lon or 77.06)
        url = f"https://www.bigbasket.com/listing-svc/v2/products?type=ps&slug={slug}&page=1&lat={lat_val}&lng={lon_val}"
        try:
            loop = asyncio.get_running_loop()

            def fetch_with_cookies():
                try:
                    self.scraper.get(
                        f"https://www.bigbasket.com/ps/?q={urllib.parse.quote(query)}",
                        headers=headers,
                        timeout=10,
                    )
                except Exception:
                    pass
                return self.scraper.get(url, headers=headers, timeout=10)

            response = await loop.run_in_executor(None, fetch_with_cookies)
            if response.status_code == 200:
                json_data = response.json()
                tabs = json_data.get("tabs", [])
                products: list[PlatformProduct] = []
                for tab in tabs:
                    product_info = tab.get("product_info", {})
                    items = product_info.get("products", [])
                    for item in items:
                        parsed = self._parse_product_item(item)
                        if parsed:
                            products.append(parsed)
                if products:
                    return products
        except Exception as exc:
            logger.warning(f"BigBasket API search failed: {exc}")

        return []

    async def _search_via_browser(self, query: str, pin: str | None = None, lat: float | None = None, lon: float | None = None) -> list[PlatformProduct]:
        async with self.lock:
            context = await self.get_context()
            page = await context.new_page()
            products: list[PlatformProduct] = []

            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort()
                    if route.request.resource_type in ["image", "media", "font"]
                    else route.continue_(),
                )

                await page.goto(
                    f"https://www.bigbasket.com/ps/?q={query}",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await page.wait_for_timeout(3500)

                cards = await page.query_selector_all("li.PaginateItems___StyledLi-sc-1yrbjdr-0")
                for card in cards:
                    name_elem = await card.query_selector("h3, .line-clamp-2")
                    price_elem = await card.query_selector(".Pricing___StyledLabel-sc-1vow5rg-1, span.Label-sc-15v1nk5-0")
                    if name_elem and price_elem:
                        name_text = await name_elem.inner_text()
                        price_text = await price_elem.inner_text()
                        try:
                            clean_price = float(price_text.replace("₹", "").replace(",", "").strip())
                            products.append(
                                PlatformProduct(
                                    platform="bigbasket",
                                    name=name_text.strip(),
                                    price=clean_price,
                                    in_stock=True,
                                    eta="15-30 mins",
                                )
                            )
                        except ValueError:
                            continue
            except Exception as exc:
                logger.error(f"BigBasket browser search failed: {exc}")
            finally:
                await page.close()

            return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        if not settings.enable_bigbasket:
            return []

        products = await self._search_via_api(query, lat, lon)
        if products:
            return products

        return await self._search_via_browser(query, pin, lat, lon)
