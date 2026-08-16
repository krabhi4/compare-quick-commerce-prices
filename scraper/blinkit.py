import asyncio
import json
import logging
import httpx
import cloudscraper
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class BlinkitScraper(BaseScraper):
    def __init__(self):
        super().__init__("blinkit")
        self.scraper = cloudscraper.create_scraper()

    def _extract_from_snippets(self, snippets: list[dict]) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        for snippet in snippets:
            data = snippet.get("data", {})
            name = data.get("name") or data.get("display_name")
            if not name:
                continue

            price_raw = data.get("normal_price") or data.get("price") or data.get("offer_price")
            mrp_raw = data.get("mrp") or data.get("market_price")
            if price_raw is None:
                continue

            try:
                price = float(str(price_raw).replace("₹", "").replace(",", "").strip())
            except ValueError:
                continue

            mrp = None
            if mrp_raw is not None:
                try:
                    mrp = float(str(mrp_raw).replace("₹", "").replace(",", "").strip())
                except ValueError:
                    mrp = None

            quantity = data.get("unit") or data.get("pack_size") or data.get("quantity")
            image_url = data.get("image_url") or data.get("image") or data.get("icon")
            product_url = None
            product_id = data.get("product_id") or data.get("id")
            if product_id:
                product_url = f"https://blinkit.com/prn/{product_id}"

            in_stock = data.get("inventory", 1) > 0 and not data.get("out_of_stock", False)
            eta = data.get("eta") or "10-15 mins"

            products.append(
                PlatformProduct(
                    platform="blinkit",
                    name=name,
                    price=price,
                    mrp=mrp,
                    quantity=quantity,
                    in_stock=in_stock,
                    product_url=product_url,
                    image_url=image_url,
                    eta=eta,
                )
            )
        return products

    async def _search_via_api(
        self, query: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "app_client": "consumer_web",
            "platform": "desktop_web",
            "content-type": "application/json",
            "accept": "application/json, text/plain, */*",
        }
        if lat and lon:
            headers["lat"] = str(lat)
            headers["lon"] = str(lon)

        body = {
            "query": query,
            "size": 30,
            "offset": 0,
        }

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.scraper.post(
                    "https://blinkit.com/v1/layout/search",
                    headers=headers,
                    json=body,
                    timeout=10,
                ),
            )
            if response.status_code == 200:
                json_data = response.json()
                snippets = (
                    json_data.get("snippets")
                    or json_data.get("data", {}).get("snippets")
                    or json_data.get("response", {}).get("snippets")
                    or []
                )
                products = self._extract_from_snippets(snippets)
                if products:
                    return products
        except Exception as exc:
            logger.warning(f"Blinkit direct API failed: {exc}")

        return []

    async def _search_via_browser(self, query: str) -> list[PlatformProduct]:
        async with self.lock:
            context = await self.get_context()
            page = await context.new_page()
            products: list[PlatformProduct] = []

            captured_payloads: list[dict] = []

            async def handle_response(response):
                try:
                    if "/search" in response.url and response.status == 200:
                        content_type = response.headers.get("content-type", "")
                        if "application/json" in content_type:
                            data = await response.json()
                            captured_payloads.append(data)
                except Exception:
                    pass

            page.on("response", handle_response)

            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort()
                    if route.request.resource_type in ["image", "media", "font"]
                    else route.continue_(),
                )
                await page.goto(
                    f"https://blinkit.com/s/?q={query}",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await page.wait_for_timeout(3000)

                for payload in captured_payloads:
                    snippets = (
                        payload.get("snippets")
                        or payload.get("data", {}).get("snippets")
                        or payload.get("response", {}).get("snippets")
                        or []
                    )
                    extracted = self._extract_from_snippets(snippets)
                    if extracted:
                        products.extend(extracted)
                        break

                if not products:
                    cards = await page.query_selector_all("[data-test-id='plp-product']")
                    for card in cards:
                        name_elem = await card.query_selector("div[title], .Product__UpdatedTitle")
                        price_elem = await card.query_selector(".Product__UpdatedPrice")
                        if name_elem and price_elem:
                            name_text = await name_elem.inner_text()
                            price_text = await price_elem.inner_text()
                            try:
                                clean_price = float(price_text.replace("₹", "").replace(",", "").strip())
                                products.append(
                                    PlatformProduct(
                                        platform="blinkit",
                                        name=name_text.strip(),
                                        price=clean_price,
                                        in_stock=True,
                                        eta="10-15 mins",
                                    )
                                )
                            except ValueError:
                                continue
            except Exception as exc:
                logger.error(f"Blinkit browser scraping failed: {exc}")
            finally:
                await page.close()

            return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        products = await self._search_via_api(query, lat, lon)
        if products:
            return products

        return await self._search_via_browser(query)
