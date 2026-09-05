import json
import logging
import re
from urllib.parse import quote_plus, unquote
from api.models import PlatformProduct
from scraper.base import BaseScraper

logger = logging.getLogger(__name__)

HOME = "https://www.zepto.com/"


def _is_search_response(response) -> bool:
    return "user-search-service/api/v3/search" in response.url and "/filters" not in response.url and response.status == 200


def _rupees(paise) -> float | None:
    return round(float(paise) / 100, 2) if paise not in (None, "") else None


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def grid_items(payload: dict) -> list[dict]:
    items: list[dict] = []
    for widget in payload.get("layout") or []:
        if widget.get("widgetId") == "PRODUCT_GRID":
            items.extend((((widget.get("data") or {}).get("resolver") or {}).get("data") or {}).get("items") or [])
    return items


def parse_items(items: list[dict]) -> list[PlatformProduct]:
    products: list[PlatformProduct] = []
    for item in items:
        pr = item.get("productResponse") or {}
        product = pr.get("product") or {}
        variant = pr.get("productVariant") or {}
        name = product.get("name")
        price = _rupees(pr.get("discountedSellingPrice") or pr.get("sellingPrice") or pr.get("mrp"))
        if not name or price is None:
            continue
        images = variant.get("images") or []
        path = images[0].get("path") if images and isinstance(images[0], dict) else None
        pvid = variant.get("id")
        products.append(
            PlatformProduct(
                platform="zepto",
                name=str(name).strip(),
                price=price,
                mrp=_rupees(pr.get("mrp")),
                quantity=variant.get("formattedPacksize"),
                in_stock=not pr.get("outOfStock", False),
                product_url=f"https://www.zepto.com/pn/{_slug(name)}/pvid/{pvid}" if pvid else None,
                image_url=f"https://cdn.zeptonow.com/production/{path}" if path else None,
                eta="10 mins",
            )
        )
    return products


class ZeptoScraper(BaseScraper):
    def __init__(self):
        super().__init__("zepto")
        self._located_pin: str | None = None
        self._serviceable = False

    async def _cookie(self, context, name: str) -> str | None:
        for c in await context.cookies(HOME):
            if c["name"] == name:
                return c["value"]
        return None

    async def _set_location(self, context, page, pin: str) -> bool:
        before = await self._cookie(context, "user_position")
        await page.goto(HOME, wait_until="domcontentloaded", timeout=30000)
        await page.click('[data-testid="user-address"]', timeout=20000)
        box = page.locator('input[placeholder="Search a new address"]')
        await box.wait_for(timeout=10000)
        await box.press_sequentially(pin, delay=60)
        first = page.locator('[data-testid="address-search-item"]').first
        await first.wait_for(timeout=15000)
        await first.click()
        for _ in range(40):
            await page.wait_for_timeout(500)
            if await self._cookie(context, "user_position") != before:
                break
        else:
            raise RuntimeError("location did not change after picking a suggestion")
        await page.wait_for_timeout(1000)
        raw = await self._cookie(context, "serviceability")
        serviceability = json.loads(unquote(raw)) if raw else {}
        return bool((serviceability.get("primaryStore") or {}).get("serviceable"))

    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        async with self.lock:
            context = await self.get_context()
            page = await context.new_page()
            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort() if route.request.resource_type in ["image", "media", "font"] else route.continue_(),
                )
                if self._located_pin != pin:
                    self._serviceable = await self._set_location(context, page, pin)
                    self._located_pin = pin
                if not self._serviceable:
                    logger.info(f"Zepto does not serve pincode {pin}")
                    return []
                async with page.expect_response(_is_search_response, timeout=30000) as first:
                    await page.goto(f"{HOME}search?query={quote_plus(query.strip())}", wait_until="commit", timeout=30000)
                items = grid_items(await (await first.value).json())
                try:
                    async with page.expect_response(_is_search_response, timeout=6000) as more:
                        await page.mouse.wheel(0, 8000)
                    items += grid_items(await (await more.value).json())
                except Exception:
                    pass
                return parse_items(items)
            except Exception as exc:
                self._located_pin = None
                logger.error(f"Zepto search failed: {exc}")
                return []
            finally:
                await page.close()
