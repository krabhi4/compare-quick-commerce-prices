import asyncio
import logging
import os
import re
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException
from api.config import settings
from api.models import AuthStatusResponse
from db.repository import get_all_identities, save_identity, remove_identity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

LOGIN_URLS: dict[str, str] = {
    "blinkit": "https://blinkit.com/login",
    "zepto": "https://www.zeptonow.com",
    "instamart": "https://www.swiggy.com/instamart",
    "flipkart": "https://www.flipkart.com/account/login",
    "bigbasket": "https://www.bigbasket.com/auth/login/",
}


@router.get("/status", response_model=AuthStatusResponse)
async def get_authentication_status() -> AuthStatusResponse:
    identities = await get_all_identities()
    all_platforms = ["blinkit", "zepto", "instamart", "flipkart", "bigbasket"]
    status_map: dict[str, str | None] = {}
    for platform in all_platforms:
        profile_path = settings.data_dir / "profiles" / platform
        has_profile = profile_path.exists() and any(profile_path.iterdir())
        if platform in identities and identities[platform]:
            status_map[platform] = identities[platform]
        elif has_profile:
            status_map[platform] = "Logged In"
        else:
            status_map[platform] = None

    return AuthStatusResponse(identities=status_map)


@router.post("/login/{platform}")
async def start_platform_login(platform: str) -> dict[str, str]:
    if platform not in LOGIN_URLS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    target_url = LOGIN_URLS[platform]
    profile_dir = settings.data_dir / "profiles" / platform
    profile_dir.mkdir(parents=True, exist_ok=True)

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            is_headless = not bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
            context = await p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=is_headless,
                viewport={"width": 1280, "height": 800},
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )

            page = await context.new_page()
            await page.goto(target_url, wait_until="domcontentloaded")

            account_identifier = None
            for _ in range(30):
                await asyncio.sleep(2)
                try:
                    content = await page.content()
                    match = re.search(r"\+?91[\s\-]?([6-9]\d{9})", content)
                    if match:
                        account_identifier = match.group(0)
                        break

                    cookies = await context.cookies()
                    has_session = any("auth" in c["name"].lower() or "token" in c["name"].lower() or "session" in c["name"].lower() for c in cookies)
                    if has_session:
                        account_identifier = "Active Session"
                        break
                except Exception:
                    pass

            await context.close()

            if account_identifier:
                await save_identity(platform, account_identifier)
                return {"status": "success", "platform": platform, "account": account_identifier}
            else:
                await save_identity(platform, "Active Session")
                return {"status": "saved", "platform": platform, "account": "Active Session"}
    except Exception as exc:
        logger.error(f"Login procedure failed for {platform}: {exc}")
        raise HTTPException(status_code=500, detail=f"Login flow failed: {exc}")


@router.post("/logout/{platform}")
async def logout_platform(platform: str) -> dict[str, str]:
    if platform not in LOGIN_URLS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    await remove_identity(platform)
    profile_dir = settings.data_dir / "profiles" / platform
    if profile_dir.exists():
        try:
            shutil.rmtree(profile_dir)
            profile_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            logger.error(f"Failed to clear profile directory for {platform}: {exc}")

    return {"status": "success", "platform": platform}
