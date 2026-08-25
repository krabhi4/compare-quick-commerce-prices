import logging
import re
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class ZeptoScraper(BaseScraper):
    def __init__(self):
        super().__init__("zepto")

    def _parse_product_variant(self, variant_data: dict) -> PlatformProduct | None:
        try:
            product_info = variant_data.get("product") or variant_data
            name = product_info.get("name") or variant_data.get("name") or product_info.get("title")
            if not name:
                return None
            price_info = variant_data.get("price") or product_info.get("price") or {}
            sp = price_info.get("sp") or price_info.get("sellingPrice") or price_info.get("discountedPrice")
            mrp = price_info.get("mrp") or price_info.get("originalPrice")
            if sp is None:
                sp = variant_data.get("discountedSellingPrice") or variant_data.get("sellingPrice") or variant_data.get("mrp")
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
                or variant_data.get("weightInGms")
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
                name=str(name).strip(),
                price=price,
                mrp=mrp_val,
                quantity=str(quantity) if quantity else None,
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
            items = resolver.get("items") or resolver.get("products") or resolver.get("data", {}).get("items") or []
            for item in items:
                product_obj = self._parse_product_variant(item)
                if product_obj:
                    products.append(product_obj)
        if not products:
            items = (
                payload.get("items")
                or payload.get("products")
                or payload.get("data", {}).get("items")
                or payload.get("data", {}).get("products")
                or []
            )
            for item in items:
                product_obj = self._parse_product_variant(item)
                if product_obj:
                    products.append(product_obj)
        return products

    async def _extract_via_dom(self, page) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        try:
            cards = await page.query_selector_all('a[data-testid="product-card"]')
            if cards:
                for card in cards[:30]:
                    try:
                        name_elem = await card.query_selector('[data-testid="product-card-name"]')
                        price_elem = await card.query_selector('[data-testid="product-card-price"]')
                        qty_elem = await card.query_selector('[data-testid="product-card-quantity"]')
                        img_elem = await card.query_selector('[data-testid="product-card-image"]')
                        mrp_elem = await card.query_selector('[data-testid="product-card-mrp"]')
                        href = await card.get_attribute("href")
                        if not name_elem or not price_elem:
                            continue
                        name_text = (await name_elem.inner_text()).strip()
                        price_text = (await price_elem.inner_text()).strip()
                        price_match = re.search(r"(\d+(?:\.\d+)?)", price_text.replace(",", ""))
                        if not price_match:
                            continue
                        price = float(price_match.group(1))
                        mrp = None
                        if mrp_elem:
                            mrp_text = (await mrp_elem.inner_text()).strip()
                            mrp_match = re.search(r"(\d+(?:\.\d+)?)", mrp_text.replace(",", ""))
                            if mrp_match:
                                mrp = float(mrp_match.group(1))
                        qty = None
                        if qty_elem:
                            qty = (await qty_elem.inner_text()).strip()
                        img_src = await img_elem.get_attribute("src") if img_elem else None
                        if not img_src:
                            img_tag = await card.query_selector("img")
                            img_src = await img_tag.get_attribute("src") if img_tag else None
                        product_url = f"https://www.zeptonow.com{href}" if href and href.startswith("/") else href
                        if name_text and len(name_text) > 2 and "add" not in name_text.lower():
                            products.append(
                                PlatformProduct(
                                    platform="zepto",
                                    name=name_text,
                                    price=price,
                                    mrp=mrp,
                                    quantity=qty,
                                    in_stock=True,
                                    product_url=product_url,
                                    image_url=img_src,
                                    eta="10 mins",
                                )
                            )
                    except Exception:
                        continue
                if products:
                    return products
        except Exception as exc:
            logger.warning(f"Zepto DOM extractor with data-testid failed: {exc}")

        try:
            links = await page.query_selector_all("a")
            seen_links = set()
            for l in links:
                href = await l.get_attribute("href")
                if not href or href in seen_links or not any(k in href for k in ["/pn/", "/prn/", "/product/"]):
                    continue
                seen_links.add(href)
                txt = await l.inner_text()
                lines = [line.strip() for line in txt.split("\n") if line.strip()]
                prices = re.findall(r"₹\s*(\d+(?:,\d+)*(?:\.\d+)?)", txt.replace(",", ""))
                if not prices:
                    prices = re.findall(r"₹(\d+(?:\.\d+)?)", txt.replace(",", ""))
                if prices:
                    try:
                        price_vals = [float(p.replace(",", "")) for p in prices]
                        price = price_vals[0]
                        mrp = price_vals[1] if len(price_vals) > 1 and price_vals[1] != price else None
                        name_candidates = [li for li in lines if "₹" not in li and "%" not in li and "off" not in li.lower() and "add" not in li.lower() and len(li) > 2]
                        if not name_candidates:
                            continue
                        name = name_candidates[0]
                        if len(name) < 3 or name.lower() in ["add", "1 pc", "1 pack"]:
                            if len(name_candidates) > 1:
                                name = name_candidates[1]
                            else:
                                continue
                        qty = None
                        for cand in name_candidates[1:]:
                            if any(u in cand.lower() for u in ["g", "ml", "kg", "ltr", "pc", "pack"]):
                                qty = cand
                                break
                        img = await l.query_selector("img")
                        img_src = await img.get_attribute("src") if img else None
                        if name and price:
                            products.append(
                                PlatformProduct(
                                    platform="zepto",
                                    name=name,
                                    price=price,
                                    mrp=mrp,
                                    quantity=qty,
                                    in_stock=True,
                                    product_url=f"https://www.zeptonow.com{href}" if href.startswith("/") else href,
                                    image_url=img_src,
                                    eta="10 mins",
                                )
                            )
                    except Exception:
                        continue
        except Exception as exc:
            logger.warning(f"Zepto fallback DOM parsing failed: {exc}")
        return products

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        async with self.lock:
            context = await self.get_context()
            lat_val = str(lat or 28.46)
            lon_val = str(lon or 77.06)
            loc_cookie = f'{{"latitude":{lat_val},"longitude":{lon_val},"city":"Delhi","pincode":"{pin or "110001"}"}}'
            await context.add_cookies([
                {"name": "userLocation", "value": loc_cookie, "domain": ".zeptonow.com", "path": "/"},
                {"name": "isLocationSet", "value": "true", "domain": ".zeptonow.com", "path": "/"},
                {"name": "userLocation", "value": loc_cookie, "domain": ".zepto.com", "path": "/"},
                {"name": "isLocationSet", "value": "true", "domain": ".zepto.com", "path": "/"},
            ])
            page = await context.new_page()
            products: list[PlatformProduct] = []
            captured_payloads: list[dict] = []

            async def handle_response(response):
                try:
                    if ("search" in response.url or "get_page" in response.url or "inventory" in response.url or "api" in response.url) and response.status == 200:
                        content_type = response.headers.get("content-type", "")
                        if "application/json" in content_type:
                            data = await response.json()
                            if isinstance(data, dict):
                                captured_payloads.append(data)
                except Exception:
                    pass

            page.on("response", handle_response)
            try:
                await page.goto(f"https://www.zeptonow.com/search?query={query}", wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(4000)
                try:
                    await page.wait_for_selector('a[data-testid="product-card"]', timeout=6000)
                except Exception:
                    pass
                for payload in captured_payloads:
                    extracted = self._parse_search_json(payload)
                    if extracted:
                        products.extend(extracted)
                if not products:
                    dom_products = await self._extract_via_dom(page)
                    products.extend(dom_products)
                if not products:
                    captured_payloads.clear()
                    await page.goto(f"https://www.zepto.com/search?q={query}", wait_until="domcontentloaded", timeout=25000)
                    await page.wait_for_timeout(4000)
                    try:
                        await page.wait_for_selector('a[data-testid="product-card"]', timeout=5000)
                    except Exception:
                        pass
                    for payload in captured_payloads:
                        extracted = self._parse_search_json(payload)
                        if extracted:
                            products.extend(extracted)
                    if not products:
                        dom_products = await self._extract_via_dom(page)
                        products.extend(dom_products)
            except Exception as exc:
                logger.error(f"Zepto scraping error: {exc}")
            finally:
                await page.close()
            return products
