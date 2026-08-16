import asyncio
import logging
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class ZeptoScraper(BaseScraper):
    def __init__(self):
        super().__init__("zepto")

    def _parse_product_variant(self, variant_data: dict) -> PlatformProduct | None:
        try:
            product_info = variant_data.get("product") or variant_data
            name = product_info.get("name") or variant_data.get("name")
            if not name:
                return None

            price_info = variant_data.get("price") or product_info.get("price") or {}
            sp = price_info.get("sp") or price_info.get("sellingPrice") or price_info.get("discountedPrice")
            mrp = price_info.get("mrp") or price_info.get("originalPrice")

            if sp is None:
                sp = variant_data.get("discountedSellingPrice") or variant_data.get("sellingPrice")
                mrp = variant_data.get("mrp")

            if sp is None:
                return None

            price = float(sp) / 100.0 if float(sp) > 500 and "." not in str(sp) else float(sp)
            mrp_val = (
                float(mrp) / 100.0 if mrp and float(mrp) > 500 and "." not in str(mrp) else float(mrp) if mrp else None
            )

            quantity = (
                variant_data.get("formattedPacksize")
                or variant_data.get("packsize")
                or product_info.get("formattedPacksize")
                or product_info.get("packsize")
            )

            images = product_info.get("images") or variant_data.get("images") or []
            image_url = None
            if isinstance(images, list) and len(images) > 0:
                first_img = images[0]
                if isinstance(first_img, dict):
                    image_url = first_img.get("path") or first_img.get("url")
                elif isinstance(first_img, str):
                    image_url = first_img

            out_of_stock = variant_data.get("outOfStock", False) or product_info.get("outOfStock", False)
            product_id = variant_data.get("id") or product_info.get("id")
            product_url = f"https://www.zeptonow.com/pn/{product_id}" if product_id else None

            return PlatformProduct(
                platform="zepto",
                name=name,
                price=price,
                mrp=mrp_val,
                quantity=quantity,
                in_stock=not out_of_stock,
                product_url=product_url,
                image_url=image_url,
                eta="10 mins",
            )
        except Exception as exc:
            logger.warning(f"Error parsing Zepto variant: {exc}")
            return None

    def _parse_search_json(self, payload: dict) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []

        layout = payload.get("layout") or []
        for widget in layout:
            data = widget.get("data", {})
            resolver = data.get("resolver", {})
            items = resolver.get("items") or resolver.get("products") or []
            for item in items:
                product_obj = self._parse_product_variant(item)
                if product_obj:
                    products.append(product_obj)

        if not products:
            items = payload.get("items") or payload.get("products") or payload.get("data", {}).get("items") or []
            for item in items:
                product_obj = self._parse_product_variant(item)
                if product_obj:
                    products.append(product_obj)

        return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
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
                    f"https://www.zeptonow.com/search?query={query}",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await page.wait_for_timeout(3500)

                for payload in captured_payloads:
                    extracted = self._parse_search_json(payload)
                    if extracted:
                        products.extend(extracted)
                        break

                if not products:
                    cards = await page.query_selector_all("[data-testid='product-card']")
                    for card in cards:
                        name_elem = await card.query_selector("[data-testid='product-card-name']")
                        price_elem = await card.query_selector("[data-testid='product-card-price']")
                        qty_elem = await card.query_selector("[data-testid='product-card-quantity']")
                        if name_elem and price_elem:
                            name_text = await name_elem.inner_text()
                            price_text = await price_elem.inner_text()
                            qty_text = await qty_elem.inner_text() if qty_elem else None
                            try:
                                clean_price = float(price_text.replace("₹", "").replace(",", "").strip())
                                products.append(
                                    PlatformProduct(
                                        platform="zepto",
                                        name=name_text.strip(),
                                        price=clean_price,
                                        quantity=qty_text.strip() if qty_text else None,
                                        in_stock=True,
                                        eta="10 mins",
                                    )
                                )
                            except ValueError:
                                continue
            except Exception as exc:
                logger.error(f"Zepto scraping error: {exc}")
            finally:
                await page.close()

            return products
