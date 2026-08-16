import asyncio
import logging
import re
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

                product_url = f"https://www.flipkart.com{product_info.get('baseUrl')}" if product_info.get("baseUrl") else None
                in_stock = product_info.get("availability", {}).get("intent") != "OUT_OF_STOCK"

                products.append(
                    PlatformProduct(
                        platform="flipkart",
                        name=str(name).strip(),
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
            "pageUri": f"/search?q={query}",
            "locationContext": {"pincode": pin},
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
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
                    if route.request.resource_type in ["media", "font"]
                    else route.continue_(),
                )

                await page.goto(
                    f"https://www.flipkart.com/search?q={query}",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await page.wait_for_timeout(4000)

                price_elems = await page.query_selector_all(".hZ3P6w, .Nx9bqj, ._30jeq3, ._25b18c")
                seen_names = set()

                for p_elem in price_elems:
                    card_handle = await page.evaluate_handle(
                        """elem => {
                            let curr = elem;
                            while (curr && curr.parentElement && !curr.getAttribute('data-id') && curr.tagName !== 'BODY') {
                                if (curr.classList.contains('_1sdMkc') || curr.classList.contains('cPHDOP') || curr.classList.contains('_75nlfW') || curr.classList.contains('slAVV4') || curr.classList.contains('_4ddWXP')) {
                                    return curr;
                                }
                                curr = curr.parentElement;
                            }
                            return curr || elem.parentElement;
                        }""",
                        p_elem,
                    )
                    card = card_handle.as_element()
                    if not card:
                        continue

                    raw_text = await card.inner_text()
                    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
                    if not lines:
                        continue

                    title_candidates = [l for l in lines if "₹" not in l and "%" not in l and not re.match(r"^\d(\.\d)?\(\d+\)$", l) and "free delivery" not in l.lower() and "bank offer" not in l.lower() and "sponsored" not in l.lower()]
                    if not title_candidates:
                        continue

                    title = title_candidates[0]
                    if title in seen_names or len(title) < 3:
                        continue
                    seen_names.add(title)

                    price_text = await p_elem.inner_text()
                    price_match = re.search(r"(\d+(?:\.\d+)?)", price_text.replace(",", ""))
                    if not price_match:
                        continue
                    price = float(price_match.group(1))

                    mrp = None
                    mrp_elem = await card.query_selector(".kRYCnD, .yRaY8j, ._3I9_wc")
                    if mrp_elem:
                        mrp_text = await mrp_elem.inner_text()
                        mrp_match = re.search(r"(\d+(?:\.\d+)?)", mrp_text.replace(",", ""))
                        if mrp_match:
                            mrp = float(mrp_match.group(1))

                    link_elem = await card.query_selector("a")
                    img_elem = await card.query_selector("img")

                    href = await link_elem.get_attribute("href") if link_elem else None
                    img_url = await img_elem.get_attribute("src") if img_elem else None

                    product_url = f"https://www.flipkart.com{href}" if href and href.startswith("/") else href

                    products.append(
                        PlatformProduct(
                            platform="flipkart",
                            name=title,
                            price=price,
                            mrp=mrp,
                            quantity=None,
                            in_stock=True,
                            product_url=product_url,
                            image_url=img_url,
                            eta="15-20 mins",
                        )
                    )
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
