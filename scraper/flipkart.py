import asyncio
import logging
import httpx
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__("flipkart")

    def _extract_from_widget_data(self, response_data: dict) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        slots = (
            response_data.get("RESPONSE", {}).get("slots")
            or response_data.get("slots")
            or response_data.get("data", {}).get("slots")
            or []
        )

        for slot in slots:
            widget = slot.get("widget", {})
            data = widget.get("data", {})
            product_list = data.get("products") or []

            for item in product_list:
                product_info = item.get("productInfo", {}).get("value", {}) or item
                titles = product_info.get("titles", {})
                name = titles.get("title") or product_info.get("title") or product_info.get("name")
                if not name:
                    continue

                pricing = product_info.get("pricing", {})
                final_price = pricing.get("finalPrice", {}).get("value") or pricing.get("totalPrice") or pricing.get("price")
                mrp_price = pricing.get("mrp", {}).get("value") or pricing.get("mrp")

                if final_price is None:
                    continue

                price = float(final_price)
                mrp = float(mrp_price) if mrp_price else None

                images = product_info.get("media", {}).get("images") or []
                image_url = None
                if images and isinstance(images, list):
                    first_img = images[0]
                    if isinstance(first_img, dict):
                        image_url = first_img.get("url")
                    elif isinstance(first_img, str):
                        image_url = first_img

                product_id = product_info.get("id") or product_info.get("baseUrl")
                product_url = f"https://www.flipkart.com{product_info.get('baseUrl')}" if product_info.get("baseUrl") else None

                in_stock = product_info.get("availability", {}).get("intent") != "OUT_OF_STOCK"

                products.append(
                    PlatformProduct(
                        platform="flipkart",
                        name=name,
                        price=price,
                        mrp=mrp,
                        quantity=None,
                        in_stock=in_stock,
                        product_url=product_url,
                        image_url=image_url,
                        eta="10-20 mins",
                    )
                )

        return products

    async def _search_via_api(self, query: str, pin: str) -> list[PlatformProduct]:
        headers = {
            "flipkart_secure": "true",
            "x-user-agent": "FKUA/website/41/website/Desktop",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        body = {
            "pageUri": f"/search?q={query}&marketplace=HYPERLOCAL",
            "locationContext": {"pincode": pin},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    "https://1.rome.api.flipkart.com/api/4/page/fetch?cacheFirst=false",
                    headers=headers,
                    json=body,
                )
                if response.status_code == 200:
                    json_data = response.json()
                    products = self._extract_from_widget_data(json_data)
                    if products:
                        return products
        except Exception as exc:
            logger.warning(f"Flipkart direct API failed: {exc}")

        return []

    async def _search_via_browser(self, query: str, pin: str) -> list[PlatformProduct]:
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
                    f"https://www.flipkart.com/search?q={query}&marketplace=GROCERY",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await page.wait_for_timeout(3000)

                cards = await page.query_selector_all("div[data-id]")
                for card in cards:
                    title_elem = await card.query_selector("a.wjcEIp, a.WKTcLC, div.KzDlHZ")
                    price_elem = await card.query_selector("div.Nx9bqj")
                    if title_elem and price_elem:
                        name_text = await title_elem.inner_text()
                        price_text = await price_elem.inner_text()
                        try:
                            clean_price = float(price_text.replace("₹", "").replace(",", "").strip())
                            products.append(
                                PlatformProduct(
                                    platform="flipkart",
                                    name=name_text.strip(),
                                    price=clean_price,
                                    in_stock=True,
                                    eta="15-20 mins",
                                )
                            )
                        except ValueError:
                            continue
            except Exception as exc:
                logger.error(f"Flipkart browser search failed: {exc}")
            finally:
                await page.close()

            return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        products = await self._search_via_api(query, pin)
        if products:
            return products
        return await self._search_via_browser(query, pin)
