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
        resp = response_data.get("RESPONSE", {}) or response_data
        slots = resp.get("slots", []) or response_data.get("slots", []) or []

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
                        eta="10-15 mins",
                    )
                )

        return products

    async def _search_page(self, page, url: str) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        captured_payloads: list[dict] = []

        async def handle_response(response):
            try:
                if ("page/fetch" in response.url or "/search" in response.url) and response.status == 200:
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        data = await response.json()
                        if isinstance(data, dict):
                            captured_payloads.append(data)
            except Exception:
                pass

        page.on("response", handle_response)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(3500)

            for payload in captured_payloads:
                extracted = self._extract_from_widget_data(payload)
                if extracted:
                    products.extend(extracted)

            if not products:
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
                            eta="10-15 mins",
                        )
                    )
        except Exception as exc:
            logger.error(f"Flipkart page search error: {exc}")

        return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        async with self.lock:
            context = await self.get_context()
            lat_val = lat or 28.6139
            lon_val = lon or 77.2090

            await context.set_geolocation({"latitude": lat_val, "longitude": lon_val})
            await context.grant_permissions(["geolocation"])
            await context.add_cookies([
                {"name": "pincode", "value": pin or "110001", "domain": ".flipkart.com", "path": "/"},
                {"name": "sn", "value": pin or "110001", "domain": ".flipkart.com", "path": "/"},
            ])

            page = await context.new_page()
            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort()
                    if route.request.resource_type in ["media", "font"]
                    else route.continue_(),
                )

                minutes_url = f"https://www.flipkart.com/search?q={query}&marketplace=HYPERLOCAL&as-show=on&as=off"
                products = await self._search_page(page, minutes_url)

                if not products:
                    fallback_url = f"https://www.flipkart.com/search?q={query}"
                    products = await self._search_page(page, fallback_url)

                return products
            finally:
                await page.close()
