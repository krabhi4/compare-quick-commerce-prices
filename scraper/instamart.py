import asyncio
import logging
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class InstamartScraper(BaseScraper):
    def __init__(self):
        super().__init__("instamart")

    def _parse_item(self, item_data: dict) -> PlatformProduct | None:
        try:
            name = item_data.get("display_name") or item_data.get("name") or item_data.get("product_name")
            if not name:
                return None

            variations = item_data.get("variations") or [item_data]
            primary_var = variations[0] if variations else item_data

            price_info = primary_var.get("price") or item_data.get("price") or {}
            offer_price_info = price_info.get("offer_price") or price_info.get("offerPrice") or {}
            mrp_info = price_info.get("mrp") or price_info.get("mrpPrice") or {}

            price = None
            if isinstance(offer_price_info, dict):
                price = offer_price_info.get("units") or offer_price_info.get("amount") or offer_price_info.get("price")
            elif isinstance(offer_price_info, (int, float)):
                price = offer_price_info

            if price is None and isinstance(price_info, (int, float)):
                price = price_info

            if price is None:
                store_price = price_info.get("store_price") or {}
                price = store_price.get("units") if isinstance(store_price, dict) else store_price

            if price is None and isinstance(item_data.get("final_price"), (int, float)):
                price = item_data.get("final_price")

            if price is None:
                return None

            mrp = None
            if isinstance(mrp_info, dict):
                mrp = mrp_info.get("units") or mrp_info.get("amount")
            elif isinstance(mrp_info, (int, float)):
                mrp = mrp_info

            quantity = (
                primary_var.get("quantity_description")
                or primary_var.get("weight_in_grams")
                or item_data.get("quantity_description")
                or item_data.get("unit")
            )
            if isinstance(quantity, (int, float)):
                quantity = f"{quantity}g"

            images = primary_var.get("images") or item_data.get("images") or []
            image_url = None
            if images:
                first_img = images[0]
                if isinstance(first_img, str):
                    if first_img.startswith("http"):
                        image_url = first_img
                    else:
                        image_url = f"https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_252,h_298/{first_img}"
                elif isinstance(first_img, dict):
                    image_url = first_img.get("url") or first_img.get("image_id")

            in_stock = primary_var.get("in_stock", True)
            product_id = item_data.get("product_id") or item_data.get("id") or item_data.get("item_id")
            product_url = f"https://www.swiggy.com/instamart/item/{product_id}" if product_id else None

            return PlatformProduct(
                platform="instamart",
                name=str(name).strip(),
                price=float(price),
                mrp=float(mrp) if mrp else None,
                quantity=str(quantity) if quantity else None,
                in_stock=bool(in_stock),
                product_url=product_url,
                image_url=image_url,
                eta="10-15 mins",
            )
        except Exception as exc:
            logger.warning(f"Error parsing Instamart item: {exc}")
            return None

    def _parse_search_json(self, payload: dict) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []

        data = payload.get("data", {})
        cards = data.get("cards") or data.get("widgets") or []

        for card in cards:
            card_data = card.get("card", {}).get("card", {}) or card.get("data", {})
            items = (
                card_data.get("items")
                or card_data.get("products")
                or card_data.get("gridElements", {}).get("infoWithStyle", {}).get("items")
                or card_data.get("itemCards")
                or []
            )
            for item in items:
                info = item.get("info") or item.get("card", {}).get("info") or item
                product_obj = self._parse_item(info)
                if product_obj:
                    products.append(product_obj)

        if not products and isinstance(data, list):
            for item in data:
                product_obj = self._parse_item(item)
                if product_obj:
                    products.append(product_obj)

        return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        async with self.lock:
            context = await self.get_context()
            lat_val = str(lat or 28.6139)
            lon_val = str(lon or 77.2090)
            await context.add_cookies([
                {"name": "lat", "value": lat_val, "domain": ".swiggy.com", "path": "/"},
                {"name": "lng", "value": lon_val, "domain": ".swiggy.com", "path": "/"},
                {"name": "address", "value": "Connaught Place, New Delhi", "domain": ".swiggy.com", "path": "/"},
            ])

            page = await context.new_page()
            products: list[PlatformProduct] = []
            captured_payloads: list[dict] = []

            async def handle_response(response):
                try:
                    if ("search" in response.url or "instamart" in response.url) and response.status == 200:
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
                    f"https://www.swiggy.com/instamart/search?custom_back=true&query={query}",
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
                    cards = await page.query_selector_all("[data-testid='ItemCard'], [data-testid='item-card']")
                    for card in cards:
                        name_elem = await card.query_selector("[data-testid='ItemName'], [data-testid='item-name']")
                        price_elem = await card.query_selector("[data-testid='ItemPrice'], [data-testid='item-price']")
                        if name_elem and price_elem:
                            name_text = await name_elem.inner_text()
                            price_text = await price_elem.inner_text()
                            try:
                                clean_price = float(price_text.replace("₹", "").replace(",", "").strip())
                                products.append(
                                    PlatformProduct(
                                        platform="instamart",
                                        name=name_text.strip(),
                                        price=clean_price,
                                        in_stock=True,
                                        eta="10-15 mins",
                                    )
                                )
                            except ValueError:
                                continue
            except Exception as exc:
                logger.error(f"Instamart scraping error: {exc}")
            finally:
                await page.close()

            return products
