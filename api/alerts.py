import asyncio
import logging
from fastapi import APIRouter, HTTPException
from api.config import settings
from api.models import AlertCreateRequest, AlertResponse
from db.repository import create_alert, get_alerts, delete_alert, update_alert_check_time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertResponse)
async def add_price_alert(request: AlertCreateRequest) -> AlertResponse:
    alert = await create_alert(
        product_query=request.product_query,
        platform=request.platform,
        target_price=request.target_price,
        pin=request.pin,
    )
    if not alert:
        raise HTTPException(status_code=500, detail="Failed to create alert")

    return AlertResponse(
        id=alert.id,
        product_query=alert.product_query,
        platform=alert.platform,
        target_price=alert.target_price,
        pin=alert.pin,
        active=alert.active,
        created_at=alert.created_at.isoformat(),
        last_checked=alert.last_checked.isoformat() if alert.last_checked else None,
    )


@router.get("", response_model=list[AlertResponse])
async def list_price_alerts() -> list[AlertResponse]:
    alerts = await get_alerts(active_only=True)
    return [
        AlertResponse(
            id=a.id,
            product_query=a.product_query,
            platform=a.platform,
            target_price=a.target_price,
            pin=a.pin,
            active=a.active,
            created_at=a.created_at.isoformat(),
            last_checked=a.last_checked.isoformat() if a.last_checked else None,
        )
        for a in alerts
    ]


@router.delete("/{alert_id}")
async def remove_price_alert(alert_id: int) -> dict[str, bool]:
    success = await delete_alert(alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


async def run_alerts_check_cycle() -> None:
    from api.search import execute_concurrent_search

    while True:
        try:
            alerts = await get_alerts(active_only=True)
            for alert in alerts:
                try:
                    search_result = await execute_concurrent_search(
                        query=alert.product_query,
                        pin=alert.pin,
                        platforms=[alert.platform] if alert.platform else None,
                    )
                    for group in search_result.results:
                        if group.cheapest_price <= alert.target_price:
                            logger.info(
                                f"Alert triggered for query '{alert.product_query}': "
                                f"found price ₹{group.cheapest_price} on {group.cheapest_platform} "
                                f"(target: ₹{alert.target_price})"
                            )
                    await update_alert_check_time(alert.id)
                except Exception as exc:
                    logger.error(f"Error checking alert {alert.id}: {exc}")

                await asyncio.sleep(2)
        except Exception as exc:
            logger.error(f"Alerts background cycle error: {exc}")

        await asyncio.sleep(settings.alert_check_interval_seconds)
