import asyncio
import logging
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class InstamartScraper(BaseScraper):
    def __init__(self):
        super().__init__("instamart")

    def _parse_item(self, item_data: dict) -> PlatformProduct | None:
        if not isinstance(item_data, dict):
            return None

        try:
            name = item_data.get("displayName") or item_data.get("name") or item_data.get("product_name")
            if not name:
                return None

            variations = item_data.get("variations") or [item_data]
            primary_var = variations[0] if variations and isinstance(variations[0], dict) else item_data

            price_info = primary_var.get("price") or item_data.get("price") or {}
            
            offer_units = None
            if isinstance(price_info, dict):
                offer_obj = price_info.get("offerPrice") or price_info.get("offer_price") or price_info.get("finalPrice")
                if isinstance(offer_obj, dict):
                    offer_units = offer_obj.get("units") or offer_obj.get("amount")
                elif isinstance(offer_obj, (int, float, str)):
                    offer_units = offer_obj

                if offer_units is None:
                    mrp_obj = price_info.get("mrp")
                    if isinstance(mrp_obj, dict):
                        offer_units = mrp_obj.get("units")
                    elif isinstance(mrp_obj, (int, float, str)):
                        offer_units = mrp_obj
            elif isinstance(price_info, (int, float, str)):
                offer_units = price_info

            if not offer_units:
                return None

            price = float(str(offer_units).replace("₹", "").replace(",", "").strip())

            mrp = None
            if isinstance(price_info, dict):
                mrp_obj = price_info.get("mrp")
                if isinstance(mrp_obj, dict):
                    mrp_val = mrp_obj.get("units") or mrp_obj.get("amount")
                else:
                    mrp_val = mrp_obj
                if mrp_val:
                    try:
                        mrp = float(str(mrp_val).replace("₹", "").replace(",", "").strip())
                    except ValueError:
                        mrp = None

            quantity = (
                primary_var.get("quantityDescription")
                or primary_var.get("quantity_description")
                or primary_var.get("weightInGrams")
                or item_data.get("quantityDescription")
            )
            if isinstance(quantity, (int, float)):
                quantity = f"{quantity}g"

            images = primary_var.get("imageIds") or primary_var.get("images") or item_data.get("images") or []
            image_url = None
            if images and isinstance(images, list):
                first_img = images[0]
                if isinstance(first_img, str):
                    if first_img.startswith("http"):
                        image_url = first_img
                    else:
                        image_url = f"https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_252,h_298/{first_img}"

            in_stock = bool(item_data.get("inStock", True)) and bool(primary_var.get("inventory", {}).get("inStock", True))
            spin_id = primary_var.get("spinId") or primary_var.get("skuId") or item_data.get("productId") or item_data.get("id")
            product_url = f"https://www.swiggy.com/instamart/item/{spin_id}" if spin_id else None

            return PlatformProduct(
                platform="instamart",
                name=str(name).strip(),
                price=price,
                mrp=mrp,
                quantity=str(quantity) if quantity else None,
                in_stock=in_stock,
                product_url=product_url,
                image_url=image_url,
                eta="10-15 mins",
            )
        except Exception as exc:
            logger.warning(f"Error parsing Instamart item: {exc}")
            return None

    def _parse_search_json(self, payload: dict) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        if not isinstance(payload, dict):
            return products

        data = payload.get("data", {})
        if not isinstance(data, dict):
            return products

        cards = data.get("cards") or data.get("widgets") or []

        for card in cards:
            if not isinstance(card, dict):
                continue
            card_obj = card.get("card", {})
            if isinstance(card_obj, dict):
                inner_card = card_obj.get("card", {})
                if isinstance(inner_card, dict):
                    grid = inner_card.get("gridElements", {})
                    if isinstance(grid, dict):
                        info_style = grid.get("infoWithStyle", {})
                        if isinstance(info_style, dict):
                            items = info_style.get("items", [])
                            if isinstance(items, list):
                                for it in items:
                                    p = self._parse_item(it)
                                    if p:
                                        products.append(p)

                    item_cards = inner_card.get("itemCards", [])
                    if isinstance(item_cards, list):
                        for it in item_cards:
                            info = it.get("card", {}).get("info") if isinstance(it, dict) else it
                            p = self._parse_item(info)
                            if p:
                                products.append(p)

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
                            if isinstance(data, dict):
                                captured_payloads.append(data)
                except Exception:
                    pass

            page.on("response", handle_response)

            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort()
                    if route.request.resource_type in ["media", "font"]
                    else route.continue_(),
                )

                await page.goto(
                    f"https://www.swiggy.com/instamart/search?custom_back=true&query={query}",
                    wait_until="domcontentloaded",
                    timeout=20000,
                )
                await page.wait_for_timeout(4000)

                for payload in captured_payloads:
                    extracted = self._parse_search_json(payload)
                    if extracted:
                        products.extend(extracted)

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
