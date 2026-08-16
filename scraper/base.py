import asyncio
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Playwright
from api.config import settings
from api.models import PlatformProduct

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    def __init__(self, platform_name: str):
        self.platform_name = platform_name
        self.profile_dir = settings.data_dir / "profiles" / platform_name
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.lock = asyncio.Lock()
        self._playwright: Playwright | None = None
        self._context: BrowserContext | None = None

    async def get_context(self, headless: bool = True) -> BrowserContext:
        if self._context is not None:
            try:
                if len(self._context.pages) > 0 or not self._context.is_closed():
                    return self._context
            except Exception:
                await self.close_context()

        if self._playwright is None:
            self._playwright = await async_playwright().start()

        args = [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--no-first-run",
        ]

        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.profile_dir),
            headless=headless,
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            args=args,
            bypass_csp=True,
            ignore_https_errors=True,
        )

        await self._context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        return self._context

    async def close_context(self) -> None:
        if self._context is not None:
            try:
                await self._context.close()
            except Exception as exc:
                logger.error(f"Error closing context for {self.platform_name}: {exc}")
            finally:
                self._context = None

        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception as exc:
                logger.error(f"Error stopping playwright for {self.platform_name}: {exc}")
            finally:
                self._playwright = None

    @abstractmethod
    async def search(
        self, query: str, pin: str, lat: float | None = None, lon: float | None = None
    ) -> list[PlatformProduct]:
        pass
