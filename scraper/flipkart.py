import logging
import re
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)


class FlipkartScraper(BaseScraper):
    def __init__(self):
        super().__init__("flipkart")
        self._configured_pin: str | None = None

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

    async def _setup_hyperlocal_location(self, page, pin: str, lat: float, lon: float) -> bool:
        try:
            await page.goto("https://www.flipkart.com/hyperlocal-preview-page?marketplace=HYPERLOCAL", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
            try:
                inp = await page.wait_for_selector('input[placeholder="Search by area, street name, pin code"]', timeout=8000)
            except Exception:
                try:
                    inp = await page.wait_for_selector("input", timeout=5000)
                except Exception:
                    return False
            await inp.click()
            await page.wait_for_timeout(500)
            await inp.fill("")
            await inp.type(pin, delay=100)
            await page.wait_for_timeout(3000)
            sugg = None
            try:
                sugg = await page.query_selector(f"text={pin}")
            except Exception:
                pass
            if not sugg:
                try:
                    divs = await page.query_selector_all("div")
                    for d in divs:
                        try:
                            tt = await d.inner_text()
                            if pin in tt and len(tt) < 200:
                                sugg = d
                                break
                        except Exception:
                            continue
                except Exception:
                    pass
            if sugg:
                try:
                    await sugg.click()
                    await page.wait_for_timeout(3500)
                except Exception:
                    return False
            confirm = None
            for sel in ['text=Confirm', 'button:has-text("Confirm")']:
                try:
                    confirm = await page.query_selector(sel)
                    if confirm:
                        break
                except Exception:
                    continue
            if confirm:
                try:
                    await confirm.click()
                    await page.wait_for_timeout(5000)
                except Exception:
                    pass
            self._configured_pin = pin
            return True
        except Exception as exc:
            logger.warning(f"Flipkart location setup failed for {pin}: {exc}")
            return False

    async def _extract_hyperlocal_dom(self, page) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        try:
            cards = await page.evaluate("""() => {
                const results = [];
                let candidates = Array.from(document.querySelectorAll('div[style*="width:300px"]'));
                if (candidates.length === 0) {
                    candidates = Array.from(document.querySelectorAll('div'));
                }
                const seen = new Set();
                for (const el of candidates) {
                    const txt = el.innerText || '';
                    if (!txt.includes('₹') || !txt.includes('Add')) continue;
                    if (txt.length > 2000 || txt.length < 20) continue;
                    const lines = txt.split('\\n').map(l=>l.trim()).filter(Boolean);
                    if (lines.length < 3) continue;
                    const priceMatch = txt.match(/₹\\s*\\d+/);
                    if (!priceMatch) continue;
                    const img = el.querySelector('img');
                    if (!img) continue;
                    const key = txt.slice(0,100);
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const link = el.querySelector('a');
                    results.push({
                        text: txt,
                        img: img ? img.getAttribute('src') : null,
                        href: link ? link.getAttribute('href') : null,
                        html: el.outerHTML.slice(0, 500)
                    });
                    if (results.length >= 30) break;
                }
                return results;
            }""")
            seen_names = set()
            for card in cards:
                try:
                    txt = card.get("text", "")
                    lines = [l.strip() for l in txt.split("\n") if l.strip()]
                    if not lines:
                        continue
                    price_matches = re.findall(r"₹\s*(\d+(?:,\d+)*(?:\.\d+)?)", txt)
                    if not price_matches:
                        continue
                    prices = []
                    for pm in price_matches:
                        try:
                            prices.append(float(pm.replace(",", "")))
                        except: pass
                    if not prices:
                        continue
                    price = prices[0]
                    mrp = prices[1] if len(prices) > 1 and prices[1] != price else None
                    title_candidates = [l for l in lines if "₹" not in l and "%" not in l and "off" not in l.lower() and "add" != l.lower() and "best seller" != l.lower() and len(l) > 2 and "min" not in l.lower()]
                    if not title_candidates:
                        continue
                    title = None
                    for cand in title_candidates:
                        if len(cand) > 3 and not cand.isdigit() and "ml" not in cand.lower() or "amul" in cand.lower() or "milk" in cand.lower():
                            title = cand
                            break
                    if not title:
                        title = title_candidates[0]
                    if title.lower() in ["add", "ad"] or len(title) < 3:
                        continue
                    if title in seen_names:
                        continue
                    seen_names.add(title)
                    href = card.get("href")
                    img_url = card.get("img")
                    qty = None
                    for cand in title_candidates[1:]:
                        if any(u in cand.lower() for u in ["ml", "g", "l", "kg", "pack"]):
                            qty = cand
                            break
                    products.append(
                        PlatformProduct(
                            platform="flipkart",
                            name=title,
                            price=price,
                            mrp=mrp,
                            quantity=qty,
                            in_stock=True,
                            product_url=f"https://www.flipkart.com{href}" if href and href.startswith("/") else href,
                            image_url=img_url,
                            eta="10-15 mins",
                        )
                    )
                except Exception:
                    continue
            if products:
                return products
        except Exception as exc:
            logger.warning(f"Hyperlocal DOM extract failed: {exc}")

        try:
            links = await page.query_selector_all('a')
            seen = set()
            for link in links:
                try:
                    href = await link.get_attribute("href")
                    if not href or "/p/" not in href:
                        continue
                    if href in seen:
                        continue
                    seen.add(href)
                    txt = await link.inner_text()
                    if not txt or "₹" not in txt:
                        parent = await link.evaluate_handle("el=>el.parentElement.parentElement")
                        parent_el = parent.as_element()
                        if parent_el:
                            txt = await parent_el.inner_text()
                    lines = [l.strip() for l in txt.split("\n") if l.strip()]
                    prices = re.findall(r"₹\s*(\d+(?:\.\d+)?)", txt.replace(",", ""))
                    if not prices:
                        continue
                    price = float(prices[0].replace(",", ""))
                    name_candidates = [l for l in lines if "₹" not in l and len(l) > 3 and "add" != l.lower()]
                    if not name_candidates:
                        continue
                    title = name_candidates[0]
                    img = await link.query_selector("img")
                    if not img:
                        card = await link.evaluate_handle("el=>el.closest('div')")
                        card_el = card.as_element()
                        if card_el:
                            img = await card_el.query_selector("img")
                    img_url = await img.get_attribute("src") if img else None
                    products.append(
                        PlatformProduct(
                            platform="flipkart",
                            name=title,
                            price=price,
                            mrp=float(prices[1].replace(",", "")) if len(prices) > 1 else None,
                            in_stock=True,
                            product_url=f"https://www.flipkart.com{href}",
                            image_url=img_url,
                            eta="10-15 mins",
                        )
                    )
                except Exception:
                    continue
        except Exception:
            pass
        return products

    async def _search_page(self, page, url: str) -> list[PlatformProduct]:
        products: list[PlatformProduct] = []
        captured_payloads: list[dict] = []
        async def handle_response(response):
            try:
                if ("page/fetch" in response.url or "/search" in response.url) and response.status == 200:
                    ct = response.headers.get("content-type", "")
                    if "application/json" in ct:
                        data = await response.json()
                        if isinstance(data, dict):
                            captured_payloads.append(data)
            except Exception:
                pass
        page.on("response", handle_response)
        try:
            wait_until = "networkidle" if "HYPERLOCAL" in url else "domcontentloaded"
            await page.goto(url, wait_until=wait_until, timeout=30000)
            await page.wait_for_timeout(6000 if "HYPERLOCAL" in url else 4000)
            for payload in captured_payloads:
                extracted = self._extract_from_widget_data(payload)
                if extracted:
                    products.extend(extracted)
            if not products:
                if "HYPERLOCAL" in url:
                    hp = await self._extract_hyperlocal_dom(page)
                    if hp:
                        products.extend(hp)
                if not products:
                    price_elems = await page.query_selector_all(".hZ3P6w, .Nx9bqj, ._30jeq3, ._25b18c")
                    seen_names = set()
                    for p_elem in price_elems:
                        try:
                            card_handle = await page.evaluate_handle("""elem => {
                                let curr = elem;
                                while (curr && curr.parentElement && !curr.getAttribute('data-id') && curr.tagName !== 'BODY') {
                                    if (curr.classList.contains('_1sdMkc') || curr.classList.contains('cPHDOP') || curr.classList.contains('_75nlfW') || curr.classList.contains('slAVV4') || curr.classList.contains('_4ddWXP')) {
                                        return curr;
                                    }
                                    curr = curr.parentElement;
                                }
                                return curr || elem.parentElement;
                            }""", p_elem)
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
                        except Exception:
                            continue
        except Exception as exc:
            logger.error(f"Flipkart page search error: {exc}")
        finally:
            try:
                page.remove_listener("response", handle_response)
            except Exception:
                pass
        return products

    async def search(self, query: str, pin: str, lat: float | None = None, lon: float | None = None) -> list[PlatformProduct]:
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
                if self._configured_pin != pin:
                    await self._setup_hyperlocal_location(page, pin, lat_val, lon_val)
                minutes_url = f"https://www.flipkart.com/search?q={query}&marketplace=HYPERLOCAL&as-show=on&as=off"
                products = await self._search_page(page, minutes_url)
                if not products:
                    if self._configured_pin != pin:
                        await self._setup_hyperlocal_location(page, pin, lat_val, lon_val)
                        products = await self._search_page(page, minutes_url)
                if not products:
                    fallback_url = f"https://www.flipkart.com/search?q={query}"
                    products = await self._search_page(page, fallback_url)
                return products
            finally:
                await page.close()
